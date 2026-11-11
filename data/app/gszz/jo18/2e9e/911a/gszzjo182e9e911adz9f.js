var me = this;
var ME = document.getElementById(me.UUID);

// The login check/redirect now rides the shared app:home control in the titlebar.

me.uiReady = function(ui) {
  me.ui = ui;
  ui.initPopups(ME);
  ME.querySelector('.wrap').style.display = 'block';

  // Dark-mode toggle retired: graphite is the one theme (ui doctrine, 2026-09).
  json('../app/read', 'lib=runtime&id=metabot_applist_filters', function(result) {
    if (result.data) {
      ME.querySelector('#appfilter-inactive').checked = !!result.data.inactive;
      ME.querySelector('#appfilter-available').checked = !!result.data.remote;
    }
    send_apps(function(result) {
      if (result.status != 'ok' && result.msg.indexOf("UNAUTHORIZED") != -1) {
        window.location.href = '../app/login.html';
      } else if (result.status != "ok") alert(result.msg);
      else {
        var div = ME.querySelector(".applist");
        me.list = result.data;
        me.list.sort((a, b) => (a.name > b.name) ? 1 : -1)
        for (var i in me.list) {
          var o = me.list[i];
          var el = document.createElement('div');
          el.className = 'appcard-wrap appcard_' + o.id;
          div.appendChild(el);
          installControl(el, "app", "appcard", function(api) {}, o);
        }
        json('../peer/peers', null, function(result) {
          for (var i in result.data) {
            var p = result.data[i];
            if (p.connected) addRemoteApps(p);
          }
        });
      }
    });
  });
};

function addRemoteApps(p) {
  send_apps(function(result) {
    for (var j in result.data) {
      var papp = result.data[j];
      var el = document.querySelector('.appcard_' + papp.id);
      if (!el) {
        papp.active = false;
        papp.remote = true;
        papp.peers = [p.id];
        me.list.push(papp);
        me.list.sort((a, b) => (a.name > b.name) ? 1 : -1);
        var n = me.list.indexOf(papp);
        el = document.createElement('div');
        el.className = 'appcard-wrap appcard_' + papp.id;
        var div = ME.querySelector(".applist>div:nth-child(" + n + ")");
        if (div) div.after(el);
        else ME.querySelector(".applist").prepend(el);
        installControl(el, "app", "appcard", function(api) {}, papp);
      } else {
        if (!el.DATA.peers) el.DATA.peers = [];
        el.DATA.peers.push(p.id);
      }
    }
  }, p.id);
}

function updateFilters() {
  ME.querySelectorAll(".appcard-wrap").forEach(function(el) {
    if (el.api && el.api.updateFilters) el.api.updateFilters();
  });
  var args = {
    inactive: ME.querySelector('#appfilter-inactive').checked,
    remote: ME.querySelector('#appfilter-available').checked
  }
  json('../app/write', 'lib=runtime&id=metabot_applist_filters&readers=[]&writers=[]&data=' + encodeURIComponent(JSON.stringify(args)), function(result) {
    if (result.status != "ok") alert(result.msg);
  });
}

ME.querySelectorAll('.switch-input').forEach(function(el) {
  el.addEventListener('change', updateFilters);
});

ME.querySelectorAll('.close-app-settings').forEach(function(el) {
  el.addEventListener('click', function() {
    document.body.api.ui.closePopup(document.body.api.closedata);
  });
});

// The gear toggles Settings. app.ui's popup() builds a new backdrop on every
// call and the gear stays clickable above it, so repeated clicks stacked
// backdrops that ✕ could no longer clear. One popup record lives here: a click
// while it is open closes it, a click while it is closing does nothing, and
// either way the open-time loaders below (registered after this) don't run.
me.settingsPopup = null;
ME.querySelector('.open-system-settings').addEventListener('click', function(e) {
  var open = me.settingsPopup;
  if (open) {
    e.stopImmediatePropagation();
    if (!open.closed) me.ui.closePopup(open);
    return;
  }
  var d = me.settingsPopup = {
    selector: '.system-settings', closeselector: '.close-system-settings', modal: true,
    clientX: e.clientX, clientY: e.clientY
  };
  // app.ui calls close() once the close animation ends, whichever control closed it
  d.close = function() { if (me.settingsPopup === d) me.settingsPopup = null; };
  me.ui.popup(d);
});

// --- Settings dialog: read side ---
var SS = ME.querySelector('.system-settings');

// "Show help": remembered per browser. Storage may be missing or throw; then help starts off.
me.readShowHelp = function(store) {
  try { return (store || window.localStorage).getItem('app-settings-showhelp') === '1'; } catch (e) { return false; }
};
me.writeShowHelp = function(on, store) {
  try { (store || window.localStorage).setItem('app-settings-showhelp', on ? '1' : '0'); } catch (e) {}
};
(function() {
  var sw = SS.querySelector('.ss-showhelp-input');
  var on = me.readShowHelp();
  sw.checked = on;
  SS.classList.toggle('ss-showhelp', on);
  sw.addEventListener('change', function() {
    SS.classList.toggle('ss-showhelp', sw.checked);
    me.writeShowHelp(sw.checked);
  });
})();

// "Who can open this device": the radios map to http_address.
function bindChoice() {
  var r = SS.querySelector('input[name=ss-bind]:checked');
  return r ? r.value : '0.0.0.0';
}
me.httpAddress = function() {
  var v = bindChoice();
  return v == 'custom' ? dget('ipaddr').value.trim() : v;
};
function setBind(addr) {
  var v = (addr == '127.0.0.1' || addr == '0.0.0.0') ? addr : 'custom';
  SS.querySelector('input[name=ss-bind][value="' + v + '"]').checked = true;
  dget('ipaddr').value = v == 'custom' ? (addr || '') : '';
}

// The LAN IPv4 other devices would use: the page's own hostname when it was
// opened from elsewhere, else the first private IPv4 (not docker's 172.17.0.1),
// else the first non-loopback IPv4.
// Is this hostname the computer the page runs on? (location.hostname gives
// IPv6 in brackets.) A plain function of the hostname, so it can be tested.
me.isLocalHost = function(hostname) {
  var h = String(hostname || '').toLowerCase();
  return h == 'localhost' || h == '127.0.0.1' || h == '::1' || h == '[::1]';
};
// The hostname this page was opened through. One seam for the warnings and the
// restart flow; a test may replace it to act as "another device".
me.pageHost = function() { return location.hostname; };

me.lanAddress = function(addresses, hostname) {
  var h = hostname || '';
  if (h && !me.isLocalHost(h)) return h;
  var v4 = (addresses || []).filter(function(a) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(a) && a.indexOf('127.') != 0 && a.indexOf('169.254.') != 0;
  });
  var priv = v4.filter(function(a) {
    if (a == '172.17.0.1') return false;
    if (a.indexOf('192.168.') == 0 || a.indexOf('10.') == 0) return true;
    var m = /^172\.(\d+)\./.exec(a);
    return m && +m[1] >= 16 && +m[1] <= 31;
  });
  return priv[0] || v4[0] || null;
};

function refreshSettings() {
  var choice = bindChoice();
  SS.querySelector('.ss-custom-ip').classList.toggle('ss-show', choice == 'custom');
  var addr = me.httpAddress();
  var st = me.settingsState();
  // An invalid port or address is never shown as a URL: the line reads — until both are valid.
  var ok = st.v.port && st.v.ip;
  var p = +st.cur.http_port === 0 ? '<port chosen at start>' : st.cur.http_port;
  var local = SS.querySelector('.ss-addr-local');
  var lan = SS.querySelector('.ss-addr-lan');
  local.textContent = !ok ? '—' : (choice == 'custom' ? 'http://' + addr + ':' : 'http://localhost:') + p;
  var other = null;  // null: only this computer can open it
  if (choice == '0.0.0.0') other = me.lanIP || '<this computer\'s IP>';
  else if (choice == 'custom') other = addr;
  lan.textContent = other === null ? 'Not reachable' : (ok ? 'http://' + other + ':' + p : '—');
  lan.classList.toggle('ss-dim', other === null);
  ssUpdate();
}
SS.querySelectorAll('input[name=ss-bind]').forEach(function(r) {
  r.addEventListener('change', function() {
    refreshSettings();
    if (r.value == 'custom' && r.checked) dget('ipaddr').focus();
  });
});
['ipaddr', 'portnum'].forEach(function(id) { dget(id).addEventListener('input', refreshSettings); });

// Start page options: active apps, built as elements. A saved start page that
// isn't active still gets an option, so an untouched save never changes it.
function fillStartPage(dbval, apps) {
  var active = apps ? String(apps).split(',').map(function(s) { return s.trim(); }) : null;
  var names = {};
  for (var i in me.list) if (!me.list[i].remote) names[me.list[i].id] = me.list[i].name;
  var select = dget('defaultbot');
  select.options.length = 0;
  var found = false;
  var add = function(id, label) {
    var opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label;
    select.appendChild(opt);
  };
  for (var j in me.list) {
    var rdi = me.list[j];
    if (rdi.remote) continue;
    if (active ? active.indexOf(rdi.id) != -1 : rdi.active) {
      add(rdi.id, rdi.name);
      if (rdi.id == dbval) found = true;
    }
  }
  if (dbval && !found) add(dbval, (names[dbval] || dbval) + ' (inactive)');
  select.value = dbval;
}

// --- Settings dialog: change tracking, validation, footer, saving ---
me.saved = null;    // the four values as loaded on open; null until the read answers
me.ssBusy = false;  // a save is in flight
me.restartPending = false;  // saved, but the restart that should follow failed (P2)

me.isIPv4 = function(s) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split('.').every(function(n) { return +n <= 255; });
};

// The four keys the dialog saves, as the form has them now.
function ssCurrent() {
  var port = dget('portnum').value.trim();
  return {
    machineid: dget('devicename').value.trim(),
    default_app: dget('defaultbot').value,
    http_address: me.httpAddress(),
    http_port: /^\d+$/.test(port) ? String(parseInt(port, 10)) : port
  };
}

// What the form says right now: validity, what changed, and which warnings apply.
me.settingsState = function() {
  var c = ssCurrent();
  var s = me.saved || c;
  var custom = bindChoice() == 'custom';
  var v = {
    name: c.machineid.length > 0,
    port: /^\d+$/.test(c.http_port) && +c.http_port <= 65535,
    ip: !custom || me.isIPv4(c.http_address)
  };
  var d = {
    name: c.machineid !== s.machineid,
    app: c.default_app !== s.default_app,
    bind: c.http_address !== s.http_address,
    port: c.http_port !== s.http_port
  };
  var n = (d.name ? 1 : 0) + (d.app ? 1 : 0) + (d.bind ? 1 : 0) + (d.port ? 1 : 0);
  // A saved address/port whose restart failed still needs one (P2).
  var restart = d.bind || d.port || me.restartPending;
  return {
    cur: c, custom: custom, v: v, valid: v.name && v.port && v.ip, dirty: d, n: n, restart: restart,
    pending: me.restartPending && n == 0,
    warnRemote: c.http_address == '127.0.0.1' && !me.isLocalHost(me.pageHost()),
    warnPort0: v.port && +c.http_port === 0 && restart
  };
};

function ssUpdate() {
  var st = me.settingsState();
  var q = function(sel) { return SS.querySelector(sel); };
  var loaded = !!me.saved;
  var ipBad = loaded && st.custom && st.cur.http_address !== '' && !st.v.ip;
  q('#ss-name-err').classList.toggle('ss-show', loaded && !st.v.name);
  dget('devicename').classList.toggle('ss-bad', loaded && !st.v.name);
  q('#ss-port-err').classList.toggle('ss-show', loaded && !st.v.port);
  dget('portnum').classList.toggle('ss-bad', loaded && !st.v.port);
  q('#ss-ip-err').classList.toggle('ss-show', ipBad);
  dget('ipaddr').classList.toggle('ss-bad', ipBad);
  q('.ss-f-name').classList.toggle('ss-dirty', st.dirty.name);
  q('.ss-f-app').classList.toggle('ss-dirty', st.dirty.app);
  q('.ss-f-bind').classList.toggle('ss-dirty', st.dirty.bind);
  q('.ss-f-port').classList.toggle('ss-dirty', st.dirty.port);
  q('.ss-net-tag').classList.toggle('ss-on', st.restart);
  q('.ss-warn-remote').classList.toggle('ss-show', loaded && st.warnRemote);
  q('.ss-warn-port0').classList.toggle('ss-show', loaded && st.warnPort0);
  var status = q('.ss-foot-status');
  status.textContent = st.pending ? 'Saved · restart still needed' :
    st.n == 0 ? 'No changes' : (st.n == 1 ? '1 change' : st.n + ' changes') + (st.restart ? ' · restart needed' : '');
  status.classList.toggle('ss-restart', st.restart);
  status.classList.toggle('ss-pending', st.pending);
  var save = q('.ss-save'), only = q('.ss-save-only');
  save.textContent = st.pending ? 'Restart now' : st.restart ? 'Save and restart' : 'Save';
  save.disabled = me.ssBusy || !loaded || (!st.pending && (st.n == 0 || !st.valid));
  only.hidden = st.pending || !st.restart;
  only.disabled = me.ssBusy || !loaded || !st.valid;
  progHold();
  return st;
}

// While a saved restart is still pending (P2), a finished checklist is hidden:
// its own ending ("no restart is needed", or a second Restart now) could
// contradict the footer. A running checklist always shows.
function progHold() {
  var hold = !!me.restartPending;
  SS.querySelectorAll('.ss-prog').forEach(function(p) {
    p.classList.toggle('ss-hold', hold && p.dataset.state != 'running');
  });
}

function ssFootErr(msg) {
  var e = SS.querySelector('.ss-foot-err');
  e.textContent = msg || '';
  e.classList.toggle('ss-show', !!msg);
}
function ssSetBusy(b) { me.ssBusy = b; ssUpdate(); }
function ssToast(msg) { if (me.ui && me.ui.snackbarMsg) me.ui.snackbarMsg(msg); }
// The header's ✕ is app.ui's close: it runs the close animation and removes the backdrop.
function ssClose() { SS.querySelector('.ss-head .close-system-settings').click(); }

// Escape closes Settings like the ✕ (edits discarded). Not while the restart
// overlay shows, and not from a <select>: there Escape belongs to its list
// (a page can't tell an open list from a closed one, so a focused select keeps it).
me.ssIsOpen = function() {
  return SS.getClientRects().length > 0 && getComputedStyle(SS).visibility != 'hidden';
};
document.addEventListener('keydown', function(e) {
  if (e.key != 'Escape' || e.defaultPrevented || e.isComposing) return;
  if (!me.ssIsOpen()) return;
  if (SS.querySelector('.ss-overlay').classList.contains('ss-show')) return;
  if (e.target && e.target.tagName == 'SELECT') return;
  e.preventDefault();
  ssClose();
});

// Save sends only the four keys. With restart, a saved config is followed by
// restart_instance; an ERROR: reply stays inline and the dialog stays open.
function ssSave(restart) {
  var st = ssUpdate();
  if (me.ssBusy || !me.saved || !st.valid || st.n == 0) return;
  var o = st.cur;
  ssFootErr('');
  ssSetBusy(true);
  send_settings(o, function(result) {
    if (!result || result.status != 'ok') {
      ssSetBusy(false);
      ssFootErr((result && result.msg) || "Couldn't save the settings.");
      return;
    }
    // The config is on disk now: these are the saved values.
    me.saved = o;
    if (!restart) {
      ssSetBusy(false);
      ssClose();
      ssToast(st.restart ? 'Saved. Network changes apply on the next restart.' : 'Saved');
      return;
    }
    me.restartNow(function(msg) {
      me.restartPending = true;
      ssFootErr('Saved, but the restart failed: ' + msg);
    });
  });
}

// Restart now: the one restart path (a restart still pending after a save, and
// a finished engine run). Only restart_instance, then the restart flow onto the
// saved address and port - where the device will answer after it starts.
// onErr(msg) gets an ERROR: reply; nothing else changes then.
me.restartNow = function(onErr) {
  if (!me.saved) return;
  ssFootErr('');
  ssSetBusy(true);
  json('../dev/restart_instance', null, function(r) {
    var msg = r && r.msg ? String(r.msg) : '';
    if (!r || r.status != 'ok' || msg.indexOf('OK') != 0) {
      onErr(msg || 'no reply');
      ssSetBusy(false);
      return;
    }
    me.restartPending = false;
    me.restartFlow(me.saved.http_address, me.saved.http_port);
  });
};
SS.querySelector('.ss-save').addEventListener('click', function() {
  var st = me.settingsState();
  if (st.pending) me.restartNow(function(msg) { ssFootErr('The restart failed: ' + msg); });
  else ssSave(st.restart);
});
SS.querySelector('.ss-save-only').addEventListener('click', function() { ssSave(false); });
dget('devicename').addEventListener('input', refreshSettings);
dget('defaultbot').addEventListener('change', refreshSettings);
dget('portnum').addEventListener('change', refreshSettings);

// Where this page finds the device after a restart. The host stays the page's
// own unless a specific address replaces it; the port is the new one.
// why lists the reasons this page can't follow (then nothing polls).
me.restartTarget = function(address, port, page) {
  page = page || { protocol: location.protocol, hostname: me.pageHost(), port: location.port };
  var host = page.hostname;
  if (address && address != '0.0.0.0' && address != '127.0.0.1' && address != host) host = address;
  var p = String(port);
  var cur = page.port || (page.protocol == 'https:' ? '443' : '80');
  var why = [];
  if (address == '127.0.0.1' && !me.isLocalHost(page.hostname)) why.push(SS.querySelector('.ss-warn-remote').textContent);
  if (+p === 0) why.push(SS.querySelector('.ss-warn-port0').textContent);
  var hostPart = host.indexOf(':') != -1 && host.charAt(0) != '[' ? '[' + host + ']' : host;
  return { origin: page.protocol + '//' + hostPart + ':' + p, same: host == page.hostname && p == cur, why: why };
};

// The overlay after an OK from restart_instance: reload in place, move to the
// new origin, or explain why this page can't follow.
me.restartFlow = function(address, port) {
  var t = me.restartTarget(address, port);
  var ov = SS.querySelector('.ss-overlay');
  var m2 = ov.querySelector('.ss-ov-msg2'), m3 = ov.querySelector('.ss-ov-msg3');
  m2.textContent = '';
  m3.textContent = '';
  ov.classList.remove('ss-stopped');
  ov.classList.add('ss-show');
  clearTimeout(me.restartTimer);
  if (t.why.length) {
    m2.textContent = t.why.join(' ');
    ov.classList.add('ss-stopped');
  } else if (t.same) {
    m2.textContent = 'This page reloads by itself when the device is back.';
    me.restartTimer = setTimeout(function tick() {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '../app/deviceid', true);
      xhr.timeout = 2000;
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 400) location.reload();
        else me.restartTimer = setTimeout(tick, 2000);
      };
      xhr.onerror = xhr.ontimeout = function() { me.restartTimer = setTimeout(tick, 2000); };
      xhr.send();
    }, 4000);
  } else {
    var url = t.origin + location.pathname;
    var a = document.createElement('a');
    a.href = url;
    a.textContent = url;
    m2.appendChild(document.createTextNode('Newbound is moving to '));
    m2.appendChild(a);
    var started = Date.now();
    me.restartTimer = setTimeout(function tick() {
      if (Date.now() - started > 90000) {
        m3.textContent = "Couldn't reach the new address. Try the link above.";
        ov.classList.add('ss-stopped');
        return;
      }
      var ctl = window.AbortController ? new AbortController() : null;
      var to = ctl ? setTimeout(function() { ctl.abort(); }, 2000) : null;
      fetch(t.origin + '/app/deviceid', { mode: 'no-cors', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
        .then(function() { clearTimeout(to); location.href = url; },
              function() { clearTimeout(to); me.restartTimer = setTimeout(tick, 2000); });
    }, 4000);
  }
  return t;
};

ME.querySelector('.open-system-settings').addEventListener('click', function() {
  // Cancel and ✕ discard edits: every open starts from the config as it is now.
  me.saved = null;
  me.ssBusy = false;
  ssFootErr('');
  SS.querySelector('.ss-overlay').classList.remove('ss-show', 'ss-stopped');
  ssUpdate();
  send_settings({}, function(result) {
    if (result && result.data) {
      dget("devicename").value = result.data.machineid || '';
      setBind(result.data.http_address);
      dget("portnum").value = parseInt(result.data.http_port);
      fillStartPage(result.data.default_app, result.data.apps);
      me.saved = ssCurrent();
      refreshSettings();
    } else {
      ssFootErr("Couldn't read the settings: " + ((result && result.msg) || 'no reply'));
    }
  });
  json('../peer/info', null, function(r) {
    var d = r && r.data ? r.data : r;
    me.lanIP = me.lanAddress(d && d.addresses, location.hostname);
    refreshSettings();
  });
});

// --- Advanced: engine versions and reinstall ---
// update_crates and hard_reset start detached runners that both report through
// update_crates_status. One renderer turns that status into a checklist: a
// missing kind is an update, a missing steps count is the kind's own (4 or 6).
me.ENGINE_STEPS = {
  update: ['Build Newbound with the new versions', 'Regenerate app code', 'Recompile add-on libraries', 'Final build'],
  hardreset: ['Download Newbound from GitHub', 'Replace platform code and core data', 'Build the new copy',
              'Regenerate app code', 'Recompile add-on libraries', 'Final build']
};
me.engine = null;      // {fl, nd} as crate_versions reported them
me.runActive = false;  // a run is starting or running: one at a time
me.runSeen = null;     // time of the last status record seen: an old record is not a new run
me.isVersion = function(v) { return /^\d[0-9A-Za-z.-]*$/.test(v); };
function eq(sel) { return SS.querySelector(sel); }
function engineErr(sel, msg) {
  var el = eq(sel);
  el.textContent = msg || '';
  el.classList.toggle('ss-show', !!msg);
}

// Enables what may run now: Update only for a real, allowed version change,
// Reinstall now only on the saved device name, nothing while a run is going.
function engineUpdate() {
  var fl = dget('flowlangver').value.trim(), nd = dget('ndataver').value.trim();
  var e = me.engine || { fl: fl, nd: nd };
  var changed = fl !== e.fl || nd !== e.nd;
  var err = '';
  if (!me.isVersion(fl) || !me.isVersion(nd)) err = 'Versions look like 0.3.41: digits and dots.';
  else if (nd !== e.nd && fl === e.fl) err = "ndata can't change on its own. New ndata versions ship with a flowlang release, so change flowlang too.";
  engineErr('.ss-ver-err', changed ? err : '');
  eq('.ss-ver-help').style.display = changed ? 'none' : '';
  dget('flowlangver').disabled = dget('ndataver').disabled = me.runActive;
  eq('.ss-upd').disabled = me.runActive || !me.engine || !changed || !!err;
  eq('.ss-hr').disabled = me.runActive;
  eq('.ss-hr-go').disabled = me.runActive || !me.saved || eq('.ss-hr-name').value !== me.saved.machineid;
  if (me.runActive) {
    eq('.ss-upd-confirm').classList.remove('ss-show');
    eq('.ss-hr-confirm').classList.remove('ss-show');
  }
}

function setLog(prog, open) {
  prog.querySelector('.ss-log').classList.toggle('ss-show', open);
  prog.querySelector('.ss-loglink').textContent = open ? 'Hide build log' : 'Show build log';
}
SS.querySelectorAll('.ss-prog').forEach(function(prog) {
  prog.querySelector('.ss-loglink').addEventListener('click', function() {
    setLog(prog, !prog.querySelector('.ss-log').classList.contains('ss-show'));
  });
});

// The checklist for one status record. Steps before `step` are done, `step`
// runs (or failed, with the server's label under it), later ones wait.
// Every server string goes in as text.
me.renderRun = function(r) {
  var kind = r.kind == 'hardreset' ? 'hardreset' : 'update';
  var prog = eq('.ss-prog-' + kind);
  eq('.ss-prog-' + (kind == 'update' ? 'hardreset' : 'update')).classList.remove('ss-show');
  var state = r.state;
  prog.dataset.state = state || '';
  var failed = state == 'failed' || state == 'stalled';
  if (state != 'running' && state != 'done' && !failed) {
    prog.classList.remove('ss-show');
    me.runActive = false;
    engineUpdate();
    return;
  }
  var labels = me.ENGINE_STEPS[kind].slice();
  var total = +r.steps > 0 ? +r.steps : labels.length;
  while (labels.length < total) labels.push('Step ' + (labels.length + 1));
  labels = labels.slice(0, total);
  var step = +r.step || 0;
  var ul = prog.querySelector('.ss-steps');
  ul.textContent = '';
  var labelShown = false;
  labels.forEach(function(text, i) {
    var n = i + 1;
    var li = document.createElement('li');
    li.className = state == 'done' || n < step ? 'ss-done' : n == step ? (failed ? 'ss-fail' : 'ss-run') : '';
    var dot = document.createElement('span');
    dot.className = 'ss-st';
    var tx = document.createElement('span');
    tx.textContent = text;
    li.appendChild(dot);
    li.appendChild(tx);
    if (failed && n == step && r.label) {
      var lb = document.createElement('div');
      lb.className = 'ss-step-label';
      lb.textContent = r.label;
      li.appendChild(lb);
      labelShown = true;
    }
    ul.appendChild(li);
  });

  var msg = prog.querySelector('.ss-prog-msg');
  msg.textContent = '';
  msg.className = 'ss-prog-msg';
  if (state == 'running') {
    msg.textContent = (step < 1 ? 'Starting. ' : '') + 'This takes several minutes. You can close Settings; progress continues.';
  } else if (failed) {
    msg.classList.add('ss-bad');
    msg.textContent = (state == 'stalled' ? 'The run stopped without reporting' : 'Stopped') +
      (step ? ' at step ' + step + ' of ' + total : '') + '.' + (!labelShown && r.label ? ' ' + r.label : '');
  } else if (r.verdict == 'no-restart') {
    msg.classList.add('ss-ok');
    msg.textContent = "Done. The program didn't change, so no restart is needed.";
  } else {
    msg.classList.add('ss-ok');
    msg.appendChild(document.createTextNode(r.verdict != 'restart' ? 'Done. Restart to be sure the new code runs.' :
      kind == 'hardreset' ? 'Reinstalled. Restart to finish.' : 'Built. Restart to switch to the new versions.'));
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'coloredbutton ss-restart-now';
    b.textContent = 'Restart now';
    var berr = document.createElement('div');
    berr.className = 'ss-prog-err';
    b.addEventListener('click', function() {
      if (me.ssBusy) return;
      b.disabled = true;
      berr.textContent = '';
      me.restartNow(function(m) { b.disabled = false; berr.textContent = 'The restart failed: ' + m; });
    });
    msg.appendChild(b);
    msg.appendChild(berr);
  }

  var lines = String(r.log_tail || '').replace(/\s+$/, '').split('\n').slice(-12).join('\n');
  prog.querySelector('.ss-log').textContent = lines;
  prog.querySelector('.ss-loglink').hidden = !lines;
  if (!lines) setLog(prog, false);
  else if (failed) setLog(prog, true);

  prog.classList.add('ss-show');
  me.runActive = state == 'running';
  if (state == 'done') loadEngine();
  engineUpdate();
  progHold();
};

// Follows the run every 3 s while it runs. Right after a start the runner may
// not have written yet: a finished record with the time seen before the start
// is the previous run, so it is skipped (up to 10 polls).
function pollRun(fresh) {
  clearInterval(me.runPoll);
  var skips = 0;
  me.runPoll = setInterval(function() {
    json('../dev/update_crates_status', null, function(r) {
      if (!r || !r.state) return;
      if (fresh && r.state != 'running' && r.time == me.runSeen && skips++ < 10) return;
      fresh = false;
      me.runSeen = r.time;
      me.renderRun(r);
      if (r.state != 'running') { clearInterval(me.runPoll); me.runPoll = null; }
    });
  }, 3000);
}

function startRun(kind, url, args, errSel) {
  if (me.runActive) return;
  me.runActive = true;
  engineErr(errSel, '');
  engineUpdate();
  json(url, args, function(r) {
    if (!r || r.status != 'ok') {
      me.runActive = false;
      engineErr(errSel, (r && r.msg) || 'No reply from the server.');
      engineUpdate();
      return;
    }
    setLog(eq('.ss-prog-' + kind), false);
    me.renderRun({ state: 'running', step: 0, kind: kind });
    pollRun(true);
  });
}

function loadEngine() {
  json('../dev/crate_versions', null, function(r) {
    var section = eq('.crate-section');
    if (r && r.status == 'ok') {
      section.style.display = '';
      me.engine = { fl: String(r.flowlang), nd: String(r.ndata) };
      if (!me.runActive) {
        dget('flowlangver').value = me.engine.fl;
        dget('ndataver').value = me.engine.nd;
      }
      section.querySelector('.ss-sum-meta').textContent = 'flowlang ' + me.engine.fl + ' · ndata ' + me.engine.nd;
    } else {
      section.style.display = 'none';
      me.engine = null;
    }
    engineUpdate();
  });
}

['flowlangver', 'ndataver'].forEach(function(id) {
  dget(id).addEventListener('input', function() {
    eq('.ss-upd-confirm').classList.remove('ss-show');
    engineErr('.ss-upd-err', '');
    engineUpdate();
  });
});
eq('.ss-upd').addEventListener('click', function() {
  engineErr('.ss-upd-err', '');
  eq('.ss-upd-what').textContent = 'flowlang ' + dget('flowlangver').value.trim() + ' · ndata ' + dget('ndataver').value.trim();
  eq('.ss-upd-confirm').classList.add('ss-show');
});
eq('.ss-upd-cancel').addEventListener('click', function() { eq('.ss-upd-confirm').classList.remove('ss-show'); });
eq('.ss-upd-go').addEventListener('click', function() {
  eq('.ss-upd-confirm').classList.remove('ss-show');
  var fl = dget('flowlangver').value.trim(), nd = dget('ndataver').value.trim();
  startRun('update', '../dev/update_crates', 'flowlang=' + encodeURIComponent(fl) + '&ndata=' + encodeURIComponent(nd), '.ss-upd-err');
});

function hrReset() {
  eq('.ss-hr-confirm').classList.remove('ss-show');
  eq('.ss-hr-name').value = '';
}
eq('.ss-hr').addEventListener('click', function() {
  engineErr('.ss-hr-err', '');
  eq('.ss-hr-want').textContent = me.saved ? me.saved.machineid : '';
  eq('.ss-hr-name').value = '';
  eq('.ss-hr-confirm').classList.add('ss-show');
  engineUpdate();
  eq('.ss-hr-name').focus();
});
eq('.ss-hr-name').addEventListener('input', engineUpdate);
eq('.ss-hr-cancel').addEventListener('click', function() { hrReset(); engineUpdate(); });
eq('.ss-hr-go').addEventListener('click', function() {
  if (!me.saved || eq('.ss-hr-name').value !== me.saved.machineid) return;
  hrReset();
  startRun('hardreset', '../dev/hard_reset', 'url=', '.ss-hr-err');
});

ME.querySelector('.open-system-settings').addEventListener('click', function() {
  eq('.ss-upd-confirm').classList.remove('ss-show');
  hrReset();
  engineErr('.ss-upd-err', '');
  engineErr('.ss-hr-err', '');
  loadEngine();
  if (me.runActive) return;  // a run started or followed from this page keeps its checklist
  // On open, only a run that is going right now shows its checklist. A done or
  // failed one is hidden at once, not when the status read answers, and stays
  // hidden until the user starts a run (E12).
  clearInterval(me.runPoll);
  me.runPoll = null;
  SS.querySelectorAll('.ss-prog').forEach(function(prog) {
    prog.classList.remove('ss-show');
    setLog(prog, false);  // a log a failed run opened doesn't stay open for the next one
  });
  engineUpdate();
  json('../dev/update_crates_status', null, function(r) {
    me.runSeen = r ? r.time : null;
    if (r && r.state == 'running') { me.renderRun(r); pollRun(false); }
  });
});

