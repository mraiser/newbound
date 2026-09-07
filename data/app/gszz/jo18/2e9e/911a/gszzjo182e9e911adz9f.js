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

ME.querySelector('.save-system-settings').addEventListener('click', function() {
  var o = {
    machineid: dget("devicename").value,
    http_address: dget("ipaddr").value,
    http_port: dget("portnum").value,
    default_app: dget("defaultbot").value
  };
  send_settings(o, function(result) {});
});

ME.querySelector('.open-system-settings').addEventListener('click', function() {
  send_settings({}, function(result) {
    if (result.data) {
      dget("devicename").value = result.data.machineid;
      dget("ipaddr").value = result.data.http_address;
      dget("portnum").value = parseInt(result.data.http_port);

      var dbval = result.data.default_app;
      var select = dget('defaultbot');
      select.options.length = 0;
      var defaultbot = "";
      for (var item in me.list) {
        var rdi = me.list[item];
        if (rdi.active)
          defaultbot += "<option value='" + rdi.id + "'>" + rdi.name + "</option>";
      }
      select.innerHTML = defaultbot;
      select.value = dbval;
    }
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
      section.style.display = 'block';
      dget('flowlangver').value = r.flowlang;
      dget('ndataver').value = r.ndata;
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
    http_address: dget('ipaddr').value,
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
