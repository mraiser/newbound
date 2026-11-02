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
me.lanAddress = function(addresses, hostname) {
  var h = hostname || '';
  if (h && h != 'localhost' && h != '127.0.0.1' && h != '::1' && h != '[::1]') return h;
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

ME.querySelector('.save-system-settings').addEventListener('click', function() {
  var o = {
    machineid: dget("devicename").value,
    http_address: me.httpAddress(),
    http_port: dget("portnum").value,
    default_app: dget("defaultbot").value
  };
  send_settings(o, function(result) {});
});

ME.querySelector('.open-system-settings').addEventListener('click', function() {
  send_settings({}, function(result) {
    if (result.data) {
      dget("devicename").value = result.data.machineid;
      setBind(result.data.http_address);
      dget("portnum").value = parseInt(result.data.http_port);
      fillStartPage(result.data.default_app, result.data.apps);
      refreshSettings();
    }
  });
  json('../peer/info', null, function(r) {
    var d = r && r.data ? r.data : r;
    me.lanIP = me.lanAddress(d && d.addresses, location.hostname);
    refreshSettings();
  });
});

// --- Platform crate versions & instance restart ---
function waitForRestart() {
  var d = ME.querySelector('.crate-update-status');
  d.style.display = 'block';
  d.textContent = 'Restarting instance...';
  setTimeout(function() {
    var t = setInterval(function() {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '../app/deviceid', true);
      xhr.timeout = 2000;
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 400) {
          clearInterval(t);
          location.reload();
        }
      };
      xhr.send();
    }, 2000);
  }, 4000);
}

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

ME.querySelector('.save-and-restart').addEventListener('click', function() {
  var o = {
    machineid: dget('devicename').value,
    http_address: me.httpAddress(),
    http_port: dget('portnum').value,
    default_app: dget('defaultbot').value
  };
  send_settings(o, function(result) {
    json('../dev/restart_instance', null, function(r) {
      if (r.msg && r.msg.indexOf('ERROR') == 0) { alert(r.msg); return; }
      waitForRestart();
    });
  });
});
