var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var data = ME.DATA;
  var url = $(".appcard-id-"+data.id).css("background-image");
  url = url.substring(5, url.length-2);
  $(ME).find('.appinfo-image').prop('src', url);
  $(ME).find('.appinfo-id').text(data.id);
  $(ME).find('.appinfo-version').text(data.version);
  $(ME).find('.appinfo-libraries').text(data.libraries);
  $(ME).find('.appinfo-author-name').text(data.authorname);
  $(ME).find('.appinfo-author-id').text(data.author);
  $(ME).find('.appinfo-desc').html(data.desc);
  
  $(ME).find('.app-edit-button').css("display", "inline-block");
  
  if (data.active) {
    $(ME).find('.app-run-button').css("display", "inline-block");
    $(ME).find('.app-deactivate-button').css("display", "inline-block");
  }
  else {
    $(ME).find('.app-activate-button').css("display", "inline-block");
    $(ME).find('.app-uninstall-button').css("display", "inline-block");
  }
  
  installControl($(ME).find('.appinfo-api')[0], 'app', 'api', function(api){}, ME.DATA);
};

$(ME).find('.app-run-button').click(function(){
  window.location.href = "../"+ME.DATA.id+"/index.html";
});

$(ME).find('.app-edit-button').click(function(){
  window.location.href = "../dev/editcontrol.html?lib="+ME.DATA.ctldb+"&id="+ME.DATA.ctlid;
});

$(ME).find('.app-uninstall-button').click(function(){
  json('../app/uninstall', 'app='+encodeURIComponent(ME.DATA.id), function(result){
    if (result.status != 'ok') alert(result.msg);
    else {
      var loc = window.location.href;
      window.location.href = loc;
    }
  });
});
    
$(ME).find('.app-activate-button').click(function(){
  json('../app/settings', 'settings={}', function(result){
    if (result.status != 'ok') alert(result.msg);
    else {
      let applist = result.data.apps;
      if (applist != '') applist += ',';
      applist += ME.DATA.id;
      var d = {
        apps: applist
      };
      json('../app/settings', 'settings='+encodeURIComponent(JSON.stringify(d)), function(result){
        if (result.status != 'ok') alert(result.msg);
        else {
          var loc = window.location.href;
          window.location.href = loc;
        }
      });
    }
  });
});

$(ME).find('.app-deactivate-button').click(function(){
  json('../app/settings', 'settings={}', function(result){
    if (result.status != 'ok') alert(result.msg);
    else {
      var applist = result.data.apps;
      var a = applist.split(",");
      var x = a.indexOf(ME.DATA.id);
      if (x != -1) {
        a.splice(x,1);
        applist = '';
        for (var i in a) {
          if (applist != '') applist += ',';
          applist += a[i];
        }
        var d = {
          apps: applist
        };
        json('../app/settings', 'settings='+encodeURIComponent(JSON.stringify(d)), function(result){
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
