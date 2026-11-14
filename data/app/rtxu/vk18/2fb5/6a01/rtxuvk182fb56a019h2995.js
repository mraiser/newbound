var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function() {
  document.body.api.ui.initProgress(ME);

  var data = ME.DATA;
  var url = getComputedStyle(document.querySelector(".appcard-id-" + data.id)).backgroundImage;
  url = url.substring(5, url.length - 2);
  ME.querySelector('.appinfo-image').src = url;
  ME.querySelector('.appinfo-id').textContent = data.id;
  ME.querySelector('.appinfo-version').textContent = data.version;
  ME.querySelector('.appinfo-libraries').textContent = data.libraries;
  ME.querySelector('.appinfo-author-name').textContent = data.authorname;
  ME.querySelector('.appinfo-author-id').textContent = data.author;
  ME.querySelector('.appinfo-desc').innerHTML = data.desc;

  if (data.active) {
    ME.querySelector('.app-edit-button').style.display = "inline-block";
    ME.querySelector('.app-run-button').style.display = "inline-block";
    ME.querySelector('.app-deactivate-button').style.display = "inline-block";
  }
  else if (data.remote) {
    ME.querySelector('.app-install-button').style.display = "inline-block";
  }
  else {
    ME.querySelector('.app-edit-button').style.display = "inline-block";
    ME.querySelector('.app-activate-button').style.display = "inline-block";
    ME.querySelector('.app-uninstall-button').style.display = "inline-block";
  }

  installControl(ME.querySelector('.appinfo-api'), 'app', 'api', function(api) {}, ME.DATA);
};

ME.querySelector('.app-run-button').addEventListener('click', function() {
  window.location.href = "../" + ME.DATA.id + "/index.html";
});

ME.querySelector('.app-edit-button').addEventListener('click', function() {
  // The app's control in the Development workbench (editcontrol.html is gone).
  window.location.href = "../dev/index.html#/bench/" + encodeURIComponent(ME.DATA.ctldb) + "/" + encodeURIComponent(ME.DATA.ctlid);
});

// Install an Available app: fetch each of its libraries this device lacks
// from the peer that offered it (dev.install_lib, which also sets up the
// app). A library that is already here is never downloaded again - that
// would replace it (and unlink a repo-linked one) with the peer's copy -
// so for those only the app the library bundles is set up
// (dev.materialize_apps). Any failure stops the run and says why.
ME.querySelector('.app-install-button').addEventListener('click', function() {
  var progress = ME.querySelector('.installprogress');
  var info = ME.querySelector('.prog-info-text');
  function say(text) {
    var i = document.createElement('i');
    i.textContent = text;
    info.replaceChildren(i);
  }
  function fail(msg) {
    progress.setProgress(0);
    say('Could not install ' + ME.DATA.name + ': ' + (msg || 'unknown error'));
    ME.querySelector('.appactions').style.display = '';
  }
  // A command that panics still answers status 'ok', with its error in
  // data: {status: 'err', msg}. Either form is a failure.
  function problem(result) {
    if (result.status != 'ok') return result.msg || 'unknown error';
    if (result.data && result.data.status == 'err') return result.data.msg || 'unknown error';
    return null;
  }
  say('Installing ' + ME.DATA.name);
  progress.setProgress('indeterminate');
  ME.querySelector('.appactions').style.display = 'none';
  ME.querySelector('.prog-info').style.display = 'block';
  json('../app/libs', null, function(result) {
    if (problem(result)) { fail(problem(result)); return; }
    var mylibs = result.data;
    var libs = ME.DATA.libraries.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
    var peer = ME.DATA.peers && ME.DATA.peers[0];
    var n = libs.length;
    var done = 0;
    var restart = false;
    function popNext() {
      if (libs.length == 0) { finish(); return; }
      var lib = libs.pop();
      progress.setProgress((done++ * 100) / n);
      if (getByProperty(mylibs, 'id', lib)) {
        say('Setting up library ' + lib);
        json('../dev/materialize_apps', 'lib=' + encodeURIComponent(lib), function(result) {
          if (problem(result)) fail(problem(result));
          else popNext();
        });
      }
      else if (!peer) fail('no connected peer offers library ' + lib);
      else {
        say('Installing library ' + lib + ' v' + ME.DATA.version);
        json('../dev/install_lib', 'lib=' + encodeURIComponent(lib) + '&uuid=' + encodeURIComponent(peer), function(result) {
          if (problem(result)) fail(problem(result));
          else {
            if (result.data === true) restart = true;
            popNext();
          }
        });
      }
    }
    // Done only when the app now lists as local; otherwise its libraries
    // are here but none of them carries the app, and reloading would just
    // show it as Available again.
    function finish() {
      json('../app/apps', null, function(result) {
        if (problem(result)) { fail(problem(result)); return; }
        if (!getByProperty(result.data, 'id', ME.DATA.id)) {
          fail('its libraries are on this device, but none of them carries the app');
          return;
        }
        progress.setProgress(100);
        if (restart) say(ME.DATA.name + ' is installed. Restart Newbound to load its new code, then activate it.');
        else window.location.href = window.location.href;
      });
    }
    popNext();
  });
});

ME.querySelector('.app-uninstall-button').addEventListener('click', function() {
  json('../app/uninstall', 'app=' + encodeURIComponent(ME.DATA.id), function(result) {
    if (result.status != 'ok') alert(result.msg);
    else {
      var loc = window.location.href;
      window.location.href = loc;
    }
  });
});

ME.querySelector('.app-activate-button').addEventListener('click', function() {
  json('../app/settings', 'settings={}', function(result) {
    if (result.status != 'ok') alert(result.msg);
    else {
      let applist = result.data.apps;
      if (applist != '') applist += ',';
      applist += ME.DATA.id;
      var d = {
        apps: applist
      };
      json('../app/settings', 'settings=' + encodeURIComponent(JSON.stringify(d)), function(result) {
        if (result.status != 'ok') alert(result.msg);
        else {
          var loc = window.location.href;
          window.location.href = loc;
        }
      });
    }
  });
});

ME.querySelector('.app-deactivate-button').addEventListener('click', function() {
  json('../app/settings', 'settings={}', function(result) {
    if (result.status != 'ok') alert(result.msg);
    else {
      var applist = result.data.apps;
      var a = applist.split(",");
      var x = a.indexOf(ME.DATA.id);
      if (x != -1) {
        a.splice(x, 1);
        applist = '';
        for (var i in a) {
          if (applist != '') applist += ',';
          applist += a[i];
        }
        var d = {
          apps: applist
        };
        json('../app/settings', 'settings=' + encodeURIComponent(JSON.stringify(d)), function(result) {
          if (result.status != 'ok') alert(result.msg);
          else {
            var loc = window.location.href;
            window.location.href = loc;
          }
        });
      }
    }
  });
});
