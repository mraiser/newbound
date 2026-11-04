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
  var port = dget('portnum').value.trim();
  var p = port === '' ? '…' : (+port === 0 ? '<port chosen at start>' : port);
  var local = SS.querySelector('.ss-addr-local');
  var lan = SS.querySelector('.ss-addr-lan');
  local.textContent = (choice == 'custom' ? 'http://' + (addr || '…') + ':' : 'http://localhost:') + p;
  var other = null;
  if (choice == '0.0.0.0') other = me.lanIP || '<this computer\'s IP>';
  else if (choice == 'custom') other = addr || '…';
  lan.textContent = other ? 'http://' + other + ':' + p : 'Not reachable';
  lan.classList.toggle('ss-dim', !other);
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
  var restart = d.bind || d.port;
  return {
    cur: c, custom: custom, v: v, valid: v.name && v.port && v.ip, dirty: d, n: n, restart: restart,
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
  status.textContent = st.n == 0 ? 'No changes' : (st.n == 1 ? '1 change' : st.n + ' changes') + (st.restart ? ' · restart needed' : '');
  status.classList.toggle('ss-restart', st.restart);
  var save = q('.ss-save'), only = q('.ss-save-only');
  save.textContent = st.restart ? 'Save and restart' : 'Save';
  save.disabled = me.ssBusy || !loaded || st.n == 0 || !st.valid;
  only.hidden = !st.restart;
  only.disabled = me.ssBusy || !loaded || !st.valid;
  return st;
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
    if (!restart) {
      ssSetBusy(false);
      ssClose();
      ssToast(st.restart ? 'Saved. Network changes apply on the next restart.' : 'Saved');
      return;
    }
    json('../dev/restart_instance', null, function(r) {
      var msg = r && r.msg ? String(r.msg) : '';
      if (!r || r.status != 'ok' || msg.indexOf('OK') != 0) {
        ssSetBusy(false);
        ssFootErr('Saved, but the restart failed: ' + (msg || 'no reply'));
        return;
      }
      me.restartFlow(o.http_address, o.http_port);
    });
  });
}
SS.querySelector('.ss-save').addEventListener('click', function() { ssSave(me.settingsState().restart); });
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

// --- Platform crate versions ---
function pollCrateUpdate() {
  var d = ME.querySelector('.crate-update-status');
  d.style.display = 'block';
  if (me.cratePoll) clearInterval(me.cratePoll);
  me.cratePoll = setInterval(function() {
    json('../dev/update_crates_status', null, function(r) {
      var s = 'state: ' + r.state + '   step ' + (r.step || 0) + '/' + (r.steps || 4) + '   ' + (r.label || '');
      if (r.state == 'done') s += '\nverdict: ' + r.verdict + (r.verdict == 'restart' ? ' — press Save and Restart to apply' : '');
      if (r.log_tail) s += '\n---\n' + r.log_tail.split('\n').slice(-12).join('\n');
      d.textContent = s;
      if (r.state != 'running') clearInterval(me.cratePoll);
    });
  }, 3000);
}

ME.querySelector('.open-system-settings').addEventListener('click', function() {
  json('../dev/crate_versions', null, function(r) {
    var section = ME.querySelector('.crate-section');
    if (r.status == 'ok') {
      section.style.display = '';
      dget('flowlangver').value = r.flowlang;
      dget('ndataver').value = r.ndata;
      section.querySelector('.ss-sum-meta').textContent = 'flowlang ' + r.flowlang + ' · ndata ' + r.ndata;
    } else {
      section.style.display = 'none';
    }
  });
  json('../dev/update_crates_status', null, function(r) {
    if (r.state == 'running') pollCrateUpdate();
  });
});

ME.querySelector('.update-crates').addEventListener('click', function() {
  var fl = dget('flowlangver').value.trim();
  var nd = dget('ndataver').value.trim();
  if (!fl || !nd) { alert('Enter both crate versions.'); return; }
  if (!confirm('Pin flowlang ' + fl + ' / ndata ' + nd + ' and rebuild the whole platform? This takes several minutes.')) return;
  json('../dev/update_crates', 'flowlang=' + encodeURIComponent(fl) + '&ndata=' + encodeURIComponent(nd), function(r) {
    var d = ME.querySelector('.crate-update-status');
    d.style.display = 'block';
    d.textContent = r.msg || r.state || 'launched';
    if (r.status == 'ok') pollCrateUpdate();
  });
});

ME.querySelector('.hard-reset').addEventListener('click', function() {
  if (!confirm('HARD RESET: re-clone canon newbound from GitHub over this instance (platform sources and core store), rebuild everything, and restart when done. Local libraries are untouched. This takes several minutes. Continue?')) return;
  json('../dev/hard_reset', 'url=', function(r) {
    var d = ME.querySelector('.crate-update-status');
    d.style.display = 'block';
    d.textContent = r.msg || 'launched';
    if (r.status == 'ok') pollCrateUpdate();
  });
});

