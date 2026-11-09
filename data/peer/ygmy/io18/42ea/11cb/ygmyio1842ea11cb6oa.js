var me = this;
var ME = document.getElementById(me.UUID);

var canvas = me.canvas = ME.querySelector('canvas');
var ctx = me.ctx = canvas.getContext('2d');

me.ready = function(){
  me.title = 'Reboot Device';
  me.redraw();
  canvas.addEventListener('mouseenter', function(){ me.hover = true; me.redraw(); });
  canvas.addEventListener('mouseleave', function(){ me.hover = false; me.redraw(); });
  canvas.addEventListener('click', function(){
    // R2.5: one request at a time — while one runs (or the Rebooting…
    // watch waits on the peer) clicks do nothing, not even a dialog.
    if (me.busy) return;
    var data = {
      title:'Reboot Device',
      text:'Are you sure you want to reboot the device?',
      cb:function(ok){
        // app.ui's confirm fires cb for BOTH buttons (true/false) — the old
        // code rebooted on Cancel too. Only a real OK runs anything.
        if (ok) rebootNow();
      }
    };
    document.body.api.ui.confirm(data);
  });
};

// R2.6: every string here is peer-reported (msg, err, the peer name) —
// textContent only, one div per line so the err text and the update
// sentence read apart.
// `why`, when given, is the explanation behind an unverified line: an
// info button on the first line opens it underneath (a tap, not a hover,
// so it works on phones too).
function setStatus(lines, why){
  var el = ME.querySelector('.rebootstatus');
  if (!el) return;
  el.textContent = '';
  var first = null;
  (lines || []).forEach(function(t){
    if (!t) return;
    var d = document.createElement('div');
    d.textContent = t;
    el.appendChild(d);
    if (!first) first = d;
  });
  if (why && first) {
    var detail = document.createElement('div');
    detail.className = 'rebootwhy';
    detail.textContent = why;
    detail.hidden = true;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'rebootinfo';
    b.title = 'Why "probably"?';
    b.setAttribute('aria-label', 'Why "probably"?');
    b.setAttribute('aria-expanded', 'false');
    var img = document.createElement('img');
    img.src = '../app/asset/app/icons/ui/dark/info.svg';
    img.alt = '';
    b.appendChild(img);
    b.addEventListener('click', function(e){
      e.stopPropagation();
      detail.hidden = !detail.hidden;
      b.setAttribute('aria-expanded', detail.hidden ? 'false' : 'true');
    });
    first.appendChild(b);
    first.parentNode.insertBefore(detail, first.nextSibling);
  }
}

function peerDiv(){ return document.getElementById('peer_' + ME.DATA.peer); }

function peerName(){
  var d = peerDiv();
  return d && d.DATA && d.DATA.name ? String(d.DATA.name) : 'This peer';
}

// R2.1: U1's honest read, shared from peer.peer (document.body.peerReplyError);
// the same check inline when the tile is mounted outside the peer page.
function replyError(result){
  if (document.body.peerReplyError) return document.body.peerReplyError(result, 'data');
  if (!result || result.status != 'ok') return 'Error: ' + (result && result.msg ? String(result.msg) : 'no reply');
  var v = result.data;
  if (v && typeof v == 'object' && v.status == 'err') return 'Error: ' + (v.msg ? String(v.msg) : '');
  return null;
}

// The peer's link as peer.peer's poll keeps it: true down, false up,
// null when the page has no record for it.
function peerDown(){
  var d = peerDiv();
  var p = d && d.DATA ? d.DATA : null;
  if (!p) return null;
  if (document.body.peerstatus) return document.body.peerstatus(p).kind == 'down';
  return !(p.tcp || p.udp || p.relay || p.connected);
}

// The link closed while the reboot request waited for its answer: the
// machine most likely went down before it could reply (Linux does, the
// moment systemctl starts the shutdown). Its own failures arrive while
// it is still up, as an answer with the reason, so they never land here.
function droppedLink(result){
  var msg = null;
  if (!result) return false;
  if (result.status != 'ok') msg = result.msg;
  else if (result.data && typeof result.data == 'object' && result.data.status == 'err') msg = result.data.msg;
  return /P2P connection closed|stale P2P connection/i.test(String(msg || ''));
}

var WHY_UNVERIFIED = function(){
  return peerName() + ' stopped responding right after the reboot request, before it could confirm. That usually means it\'s restarting, but it can\'t be verified from here.';
};

// R2.2, extended: after a reboot request, report what the peer's own
// record shows (peer.peer's poll keeps it fresh) - it goes offline, then
// comes back - instead of claiming a reboot nobody saw. `unverified` is
// the dropped-link case, whose lines keep the explanation until the peer
// is back. Still connected after 60 s is its own answer; offline for
// 15 min stops the watch with the line as it stands.
function watchRestart(unverified){
  if (me.watch) clearInterval(me.watch);
  var start = Date.now();
  var wentDown = 0;
  var why = unverified ? WHY_UNVERIFIED() : null;
  var t = me.watch = setInterval(function(){
    if (!ME.isConnected) { clearInterval(t); return; }
    var down = peerDown();
    if (!wentDown) {
      if (down) {
        wentDown = Date.now();
        // the tile is free again once the peer is offline; the watch for
        // its return goes on until a new request replaces it
        me.busy = false;
        setStatus([peerName() + ' went offline, as expected for a restart.', 'It reconnects once Newbound is running there again.'], why);
      }
      else if (Date.now() - start >= 60000) {
        clearInterval(t);
        me.busy = false;
        setStatus([peerName() + ' is still connected; the reboot may not have run.']);
      }
    }
    else if (down === false) {
      clearInterval(t);
      setStatus([peerName() + ' is back online.']);
    }
    else if (Date.now() - wentDown >= 15 * 60000) {
      clearInterval(t);
      setStatus([peerName() + " hasn't come back yet.", 'It reconnects once Newbound is running there again.'], why);
    }
  }, 2000);
}

function rebootNow(){
  if (me.busy) return;
  me.busy = true;
  // a new request replaces the last one's watch for the peer's return
  if (me.watch) { clearInterval(me.watch); me.watch = null; }
  setStatus([]);
  var peer = ME.DATA.peer;
  // the pre-scene constellation hung a THREE api (sphere) off the peer
  // div; the stub divs no longer carry it, so the spin is best-effort
  var pdiv = peerDiv();
  var api = pdiv ? pdiv.api : null;
  if (api && api.sphere) api.sphere.rotation.speed = 0.05;
  json('../peer/remote/'+peer+'/app/exec', 'lib=peer&id=sqgqnm18434391301x302&args={}', function(result){
    if (api && api.sphere) api.sphere.rotation.speed = null;
    // R2.1: status:ok alone lies (U1) — a wrapped {status:err} in data is
    // an error, and the new command's own failure arrives FLAT as
    // status:err with the sentence in msg.
    if (droppedLink(result)) {
      // no answer, so no claim: say what was seen, explain behind ⓘ,
      // and let the peer's record show what really happens next
      setStatus(['Connection lost: probably restarting.'], WHY_UNVERIFIED());
      watchRestart(true);
      return;
    }
    var err = replyError(result);
    if (err != null) { setStatus([err]); me.busy = false; return; }
    if (result.dryrun) {
      // R2.3: a test must never read as a reboot — name what WOULD run.
      var first = result.plan && result.plan[0] ? result.plan[0].join(' ') : '';
      setStatus([first ? 'Dry run: would run ' + first : 'Dry run: nothing was run.']);
      me.busy = false;
      return;
    }
    if (result.method) {
      // R2.2: the machine named the command it ran — now wait for it to
      // actually go down and come back (watchRestart clears me.busy).
      setStatus(['Rebooting…']);
      watchRestart(false);
      return;
    }
    // R2.4: ok with no method and no dryrun — the peer still runs the OLD
    // command, whose system_call reply says ok whatever happened. Never
    // success: show its stderr if it has any, and say what fixes it.
    var lines = [];
    if (result.err) lines.push(String(result.err));
    lines.push(peerName() + ' needs updating before Reboot can work.');
    setStatus(lines);
    me.busy = false;
  });
}

me.redraw = function(){
  // R2.7: the square comes from the width alone — the status is in flow
  // below the canvas now, so ME.clientHeight includes it.
  var w = ME.clientWidth;
  var h = w;

  var L = Math.min(w,h);
  var offx = (w-L)/2;
  var offy = (h-L)/2;

  var fontsize = 18*L/150;
  var stroke1 = 15*L/150;
  var stroke2 = 2*L/150;

  var h3 = 130*L/150;

  canvas.width = w;
  canvas.height = h;

  ctx.lineWidth = stroke1;
  ctx.strokeStyle = me.hover ? '#4bff2a' : '#4b8c2a';
  ctx.fillStyle = me.hover ? '#4bff2a' : '#4b8c2a';

  var delta = 0.14;
  var off = L * delta;
  var bw = L * (1-delta*2);
  var radius = bw * 0.40;
  var stroke = bw / 10;

  var rs = radius + stroke + off;

  ctx.beginPath();
  ctx.arc(rs+offx, rs-off/2, radius, -0.4 * Math.PI , 1.4 * Math.PI, false);
  ctx.lineWidth = stroke;
  ctx.stroke();
  ctx.fillRect(radius + (stroke/2)+off+offx, off/2, stroke, rs);

  ctx.font = fontsize+"px Arial";
  ctx.fillStyle = '#fff';
  ctx.lineWidth = stroke2;
  ctx.strokeStyle = '#000';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'black';

  ctx.strokeText(me.title,w/2,h3);
  ctx.fillText(me.title,w/2,h3);
};
