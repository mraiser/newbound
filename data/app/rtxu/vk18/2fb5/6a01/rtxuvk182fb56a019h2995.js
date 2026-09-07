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
  window.location.href = "../dev/editcontrol.html?lib=" + ME.DATA.ctldb + "&id=" + ME.DATA.ctlid;
});

ME.querySelector('.app-install-button').addEventListener('click', function() {
  json('../app/libs', null, function(result) {
    var mylibs = result.data;
    var libs = ME.DATA.libraries.split(",");
    ME.querySelector('.prog-info-text').innerHTML = '<i>Installing ' + ME.DATA.name + '</i>';
    ME.querySelector('.installprogress').setProgress('indeterminate');
    ME.querySelector('.appactions').style.display = 'none';
    ME.querySelector('.prog-info').style.display = 'block';
    var n = libs.length;
    var i = 0;
    function popNext() {
      if (libs.length > 0) {
        var lib = libs.pop();
        if (!getByProperty(mylibs, 'id', lib)) {
          var uuid = ME.DATA.peers[i];
          var p = (i++ * 100) / n;
          ME.querySelector('.installprogress').setProgress(p);
          ME.querySelector('.prog-info-text').innerHTML = '<i>Installing library ' + lib + ' v' + ME.DATA.version + '</i>';
          json('../dev/install_lib', 'lib=' + lib + '&uuid=' + uuid, function(result) {
            popNext();
          });
        }
      }
      else {
        ME.querySelector('.installprogress').setProgress(100);
        window.location.href = window.location.href;
      }
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
