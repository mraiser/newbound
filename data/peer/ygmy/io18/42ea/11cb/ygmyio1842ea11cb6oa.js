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
    var el = document.createElement('div');
    el.className = 'popup999 wrap';
    document.body.appendChild(el);
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
// sentence read apart. The status paints under the tile's fixed box.
function setStatus(lines){
  var el = ME.querySelector('.rebootstatus');
  if (!el) return;
  el.textContent = '';
  (lines || []).forEach(function(t){
    if (!t) return;
    var d = document.createElement('div');
    d.textContent = t;
    el.appendChild(d);
  });
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

// R2.2: success means the machine is going down — watch the peer's own
// record (peer.peer's poll keeps it fresh) until the link drops; the orb
// greys on its own. Still connected after 60 s is its own answer.
function watchDown(){
  var start = Date.now();
  var t = setInterval(function(){
    if (!ME.isConnected) { clearInterval(t); return; }
    var d = peerDiv();
    var p = d && d.DATA ? d.DATA : null;
    var down = p ? !(p.tcp || p.udp || p.relay || p.connected) : false;
    if (p && document.body.peerstatus) down = document.body.peerstatus(p).kind == 'down';
    if (down) {
      clearInterval(t);
      me.busy = false;
      setStatus([]);
    }
    else if (Date.now() - start >= 60000) {
      clearInterval(t);
      me.busy = false;
      setStatus([peerName() + " hasn't gone down yet."]);
    }
  }, 2000);
}

function rebootNow(){
  if (me.busy) return;
  me.busy = true;
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
      // actually go down (watchDown clears me.busy).
      setStatus(['Rebooting…']);
      watchDown();
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
  var w = ME.clientWidth;
  var h = ME.clientHeight;

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
