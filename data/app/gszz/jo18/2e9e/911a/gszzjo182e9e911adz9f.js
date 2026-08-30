var me = this;
var ME = $('#' + me.UUID)[0];

json('../app/newlib', 'lib=runtime&readers=[]&writers=[]', function(result) {
  if (result.status != 'ok' && result.msg.indexOf("UNAUTHORIZED") != -1) {
    window.location.href = '../app/login.html';
  }
});

me.uiReady = function(ui) {
  me.ui = ui;
  ui.initPopups(ME);
  $(ME).find('.wrap').css('display', 'block');

  // --- Dark Mode Logic ---
  const darkModePref = localStorage.getItem('darkMode');
  const toggle = $(ME).find('#dark-mode-switch-app');

  if (darkModePref === 'enabled') {
    $('body').addClass('dark');
    toggle.prop('checked', true);
  }

  toggle.on('change', function() {
    if ($(this).is(':checked')) {
      $('body').addClass('dark');
      localStorage.setItem('darkMode', 'enabled');
    } else {
      $('body').removeClass('dark');
      localStorage.setItem('darkMode', 'disabled');
    }
  });
  // --- End Dark Mode Logic ---

  json('../app/read', 'lib=runtime&id=metabot_applist_filters', function(result) {
    if (result.data) {
      $(ME).find('#appfilter-inactive').prop('checked', result.data.inactive);
      $(ME).find('#appfilter-available').prop('checked', result.data.remote);
    }
    send_apps(function(result) {
      if (result.status != 'ok' && result.msg.indexOf("UNAUTHORIZED") != -1) {
        window.location.href = '../app/login.html';
      } else if (result.status != "ok") alert(result.msg);
      else {
        var div = $(ME).find(".applist");
        me.list = result.data;
        me.list.sort((a, b) => (a.name > b.name) ? 1 : -1)
        for (var i in me.list) {
          var o = me.list[i];
          var el = $("<div class='appcard-wrap appcard_" + o.id + "'/>");
          div.append(el);
          installControl(el[0], "app", "appcard", function(api) {}, o);
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
      var el = $('.appcard_' + papp.id)[0];
      if (!el) {
        papp.active = false;
        papp.remote = true;
        papp.peers = [p.id];
        me.list.push(papp);
        me.list.sort((a, b) => (a.name > b.name) ? 1 : -1);
        var n = me.list.indexOf(papp);
        var el = $("<div class='appcard-wrap appcard_" + papp.id + "'/>");
        var div = $(ME).find(".applist>div:nth-child(" + n + ")");
        div.after(el);
        installControl(el[0], "app", "appcard", function(api) {}, papp);
      } else {
        if (!el.DATA.peers) el.DATA.peers = [];
        el.DATA.peers.push(p.id);
      }
    }
  }, p.id);
}

function updateFilters() {
  let list = $(ME).find(".appcard-wrap");
  for (var i in list) {
    var el = list[i];
    if (el.api && el.api.updateFilters) el.api.updateFilters();
  }
  var args = {
    inactive: $('#appfilter-inactive').prop('checked'),
    remote: $(ME).find('#appfilter-available').prop('checked')
  }
  json('../app/write', 'lib=runtime&id=metabot_applist_filters&readers=[]&writers=[]&data=' + encodeURIComponent(JSON.stringify(args)), function(result) {
    if (result.status != "ok") alert(result.msg);
  });
}

$(ME).find('.switch-input').change(updateFilters);

$(ME).find('.close-app-settings').click(function() {
  document.body.api.ui.closePopup(document.body.api.closedata);
});

$(ME).find('.save-system-settings').click(function() {
  var devicename = $("#devicename").val();
  var ipaddr = $("#ipaddr").val();
  var portnum = $("#portnum").val();
  var defaultbot = $("#defaultbot").val();
  var o = {
    machineid: devicename,
    http_address: ipaddr,
    http_port: portnum,
    default_app: defaultbot
  };
  send_settings(o, function(result) {});
});

$(ME).find('.open-system-settings').click(function() {
  send_settings({}, function(result) {
    if (result.data) {
      $("#devicename").val(result.data.machineid);
      $("#ipaddr").val(result.data.http_address);
      $("#portnum").val(parseInt(result.data.http_port));

      var dbval = result.data.default_app;
      var select = document.getElementById('defaultbot');
      select.options.length = 0;
      var defaultbot = "";
      for (var item in me.list) {
        var rdi = me.list[item];
        if (rdi.active)
          defaultbot += "<option value='" + rdi.id + "'>" + rdi.name + "</option>";
      }
      $('#defaultbot').html(defaultbot);
      $('#defaultbot').val(dbval);
    }
  });
});

// --- Platform crate versions & instance restart ---
function waitForRestart() {
  var d = $(ME).find('.crate-update-status');
  d.show().text('Restarting instance...');
  setTimeout(function() {
    var t = setInterval(function() {
      $.ajax({ url: '../app/deviceid', timeout: 2000 }).done(function() {
        clearInterval(t);
        location.reload();
      });
    }, 2000);
  }, 4000);
}

function pollCrateUpdate() {
  var d = $(ME).find('.crate-update-status');
  d.show();
  if (me.cratePoll) clearInterval(me.cratePoll);
  me.cratePoll = setInterval(function() {
    json('../dev/update_crates_status', null, function(r) {
      var s = 'state: ' + r.state + '   step ' + (r.step || 0) + '/' + (r.steps || 4) + '   ' + (r.label || '');
      if (r.state == 'done') s += '\nverdict: ' + r.verdict + (r.verdict == 'restart' ? ' — press Save and Restart to apply' : '');
      if (r.log_tail) s += '\n---\n' + r.log_tail.split('\n').slice(-12).join('\n');
      d.text(s);
      if (r.state != 'running') clearInterval(me.cratePoll);
    });
  }, 3000);
}

$(ME).find('.open-system-settings').click(function() {
  json('../dev/crate_versions', null, function(r) {
    if (r.status == 'ok') {
      $(ME).find('.crate-section').show();
      $('#flowlangver').val(r.flowlang);
      $('#ndataver').val(r.ndata);
    } else {
      $(ME).find('.crate-section').hide();
    }
  });
  json('../dev/update_crates_status', null, function(r) {
    if (r.state == 'running') pollCrateUpdate();
  });
});

$(ME).find('.update-crates').click(function() {
  var fl = $('#flowlangver').val().trim();
  var nd = $('#ndataver').val().trim();
  if (!fl || !nd) { alert('Enter both crate versions.'); return; }
  if (!confirm('Pin flowlang ' + fl + ' / ndata ' + nd + ' and rebuild the whole platform? This takes several minutes.')) return;
  json('../dev/update_crates', 'flowlang=' + encodeURIComponent(fl) + '&ndata=' + encodeURIComponent(nd), function(r) {
    var d = $(ME).find('.crate-update-status');
    d.show().text(r.msg || r.state || 'launched');
    if (r.status == 'ok') pollCrateUpdate();
  });
});

$(ME).find('.hard-reset').click(function() {
  if (!confirm('HARD RESET: re-clone canon newbound from GitHub over this instance (platform sources and core store), rebuild everything, and restart when done. Local libraries are untouched. This takes several minutes. Continue?')) return;
  json('../dev/hard_reset', 'url=', function(r) {
    var d = $(ME).find('.crate-update-status');
    d.show().text(r.msg || 'launched');
    if (r.status == 'ok') pollCrateUpdate();
  });
});

$(ME).find('.save-and-restart').click(function() {
  var o = {
    machineid: $('#devicename').val(),
    http_address: $('#ipaddr').val(),
    http_port: $('#portnum').val(),
    default_app: $('#defaultbot').val()
  };
  send_settings(o, function(result) {
    json('../dev/restart_instance', null, function(r) {
      if (r.msg && r.msg.indexOf('ERROR') == 0) { alert(r.msg); return; }
      waitForRestart();
    });
  });
});
