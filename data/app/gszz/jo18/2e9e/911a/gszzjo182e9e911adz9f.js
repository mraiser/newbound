var me = this; 
var ME = $('#'+me.UUID)[0];

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
      if (result.status != "ok") alert(result.msg);
      else {
        var div = $(ME).find(".applist");
        me.list = result.data;
        me.list.sort((a, b) => (a.name > b.name) ? 1 : -1)
        for (var i in me.list) {
          var o = me.list[i];
          var el = $("<div class='appcard-wrap'/>");
          div.append(el);
          installControl(el[0], "app", "appcard", function(api){}, o);
        }
      }
    });
  });
};

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