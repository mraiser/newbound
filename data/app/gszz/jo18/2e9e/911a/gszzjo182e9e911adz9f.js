var me = this; 
var ME = $('#'+me.UUID)[0];

json('../app/newlib', 'lib=runtime&readers=[]&writers=[]', function(result){
  if (result.status != 'ok' && result.msg.indexOf("UNAUTHORIZED") != -1) {
    window.location.href = '../app/login.html';
  }
});

me.uiReady = function(ui){
  me.ui = ui;
  ui.initPopups(ME);
  $(ME).find('.wrap').css('display', 'block');
  json('../app/read', 'lib=runtime&id=metabot_applist_filters', function(result){
    if (result.data){
      $(ME).find('#appfilter-inactive').prop('checked', result.data.inactive); 
      $(ME).find('#appfilter-available').prop('checked', result.data.remote);
    }
    send_apps(function(result){
      if (result.status != 'ok' && result.msg.indexOf("UNAUTHORIZED") != -1) {
        window.location.href = '../app/login.html';
      }
      else if (result.status != "ok") alert(result.msg);
      else {
        var div = $(ME).find(".applist");
        me.list = result.data;
        me.list.sort((a, b) => (a.name > b.name) ? 1 : -1)
        for (var i in me.list) {
          var o = me.list[i];
          var el = $("<div class='appcard-wrap appcard_"+o.id+"'/>");
          div.append(el);
          installControl(el[0], "app", "appcard", function(api){}, o);
        }
        json('../peer/peers', null, function(result){
          for (var i in result.data) {
            var p = result.data[i];
            if (p.connected) addRemoteApps(p);
          }
        });
      }
    });
  });
};

function addRemoteApps(p){
  send_apps(function(result){
    for (var j in result.data) {
      var papp = result.data[j];
      var el = $('.appcard_'+papp.id)[0];
      if (!el) {
        papp.active = false;
        papp.remote = true;
        papp.peers = [p.id];
        me.list.push(papp);
        me.list.sort((a, b) => (a.name > b.name) ? 1 : -1);
        var n = me.list.indexOf(papp);
        var el = $("<div class='appcard-wrap appcard_"+papp.id+"'/>");
        var div = $(ME).find(".applist>div:nth-child("+n+")");
        div.after(el);
        installControl(el[0], "app", "appcard", function(api){}, papp);
      }
      else {
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
  var args = { inactive: $('#appfilter-inactive').prop('checked'), remote: $(ME).find('#appfilter-available').prop('checked') }
  json('../app/write', 'lib=runtime&id=metabot_applist_filters&readers=[]&writers=[]&data='+encodeURIComponent(JSON.stringify(args)), function(result){
    if (result.status != "ok") alert(result.msg);
  });
}

$(ME).find('.switch-input').change(updateFilters);

$(ME).find('.close-app-settings').click(function(){
  document.body.api.ui.closePopup(document.body.api.closedata);
});

$(ME).find('.save-system-settings').click(function(){
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
  send_settings(o, function(result){});
});

$(ME).find('.open-system-settings').click(function(){
  send_settings({}, function(result){
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
          defaultbot += "<option value='"+rdi.id+"'>"+rdi.name+"</option>";
      }
      $('#defaultbot').html(defaultbot);
      $('#defaultbot').val(dbval);
    }
  });
});