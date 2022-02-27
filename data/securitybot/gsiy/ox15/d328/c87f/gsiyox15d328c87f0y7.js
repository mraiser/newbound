var me = this; 
var ME = $('#'+me.UUID)[0];

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  ui.initNavbar(ME);
  //ui.initPopups(ME);
  document.body.ui = ui;
};

me.ready = function(){
  json('../securitybot/listgroups', null, function(result){
    var list = document.body.localgroups = result.data;
    var label = "Filter By Group"
    var allownone = true;
    var cb = function(val){ filter('user', val); };
    var data = {list:list,label:label,allownone:allownone,cb:cb};
    installControl($(ME).find('.userfilter')[0], 'metabot', 'select', function(){}, data);
    cb = function(val){ filter('device', val); };
    data = {list:list,label:label,allownone:allownone,cb:cb};
    installControl($(ME).find('.devicefilter')[0], 'metabot', 'select', function(){}, data);
  });  
  
  updateDeviceInfo();
  listUsers();
  listApps();
};

function filter(type, val){
  var listdiv = $('.'+type+'list');
  if (val == '') 
    listdiv.find('.userrow').css('display','table-row');
  else{
    listdiv.find('.userrow').css('display','none');
    var list = listdiv[0][type+'s'];
    for (var i in list){
      var g = list[i].groups;
      if (g.indexOf(val) != -1 || (g.length==0 && val == 'anonymous'))
        listdiv.find('.userrow_'+i).css('display','table-row');
    }
  }
}

function listApps() {
  json('../securitybot/listapps', null,function(result){
    var list = result.data;
    console.log(list);
    var apps = {};
    var newhtml = '<table border="0" cellpadding="20" cellspacing="0" class="apptable">';
    for (var item in result.data) {
      var app = result.data[item];
      var groups = app.include ? app.include.join() : '';
      if (groups == '') groups = '<i>no groups</i>';
      var cmds = '';
      for (var cmdname in app.commands){
        var cmd = app.commands[cmdname];
        var cmdgroups = cmd.include ? cmd.include.join() : '<i>no groups</i>';
        if (cmds != '') cmds += '<br>';
        cmds += cmdname+' ['+cmdgroups+']';
      }
      if (cmds == '') cmds = '<i>no commands</i>';
        
      newhtml += '<tr data-id="'+app.id+'" class="userrow userrow_'+app.id+'"><td><img src="../botmanager/asset/botmanager/app_icon.png" width="20" height="20"></td><td>'+app.name+' ('+app.id+')</td><td>'+cmds+'</td></tr>';
      apps[app.id] = app;
     }
    newhtml += '</table>';
    var el = $(ME).find('.applist');
    el[0].apps = apps;
    el.html(newhtml);
    
    el.find('.userrow').click(function(){
      var id = $(this).data('id');
      el = $(ME).find('.editapppopup');
      var u = apps[id];
      u = JSON.stringify(u);
      u = JSON.parse(u);
      u.cb = function(){
        listApps();
      };
      
      var d = {
        cb: function(){
          var el2 = el.find('.allthestuff');
          installControl(el2[0], 'securitybot', 'appcard', function(cardapi){
            el2.find('.appcard-closebutton').click(function(){
              el[0].popup.close(function(){
                el.css('display', 'none');
              });
            });
          }, u);
        }
      };
      
      installControl(el[0], 'metabot', 'popupdialog', function(popupapi){
        el[0].popup = popupapi;
      }, d);
      
    });
  });
}

function listUsers() {
  json('../securitybot/listusers', null,function(result){
    var list = result.data;
    console.log(list);
    var users = {};
    var devices = {};
    var userhtml = '<table border="0" cellpadding="20" cellspacing="0" class="usertable">';
    var devicehtml = '<table border="0" cellpadding="20" cellspacing="0" class="devicetable">';
    for (var i=0;i<list.length;i++){
      var newhtml = '';
      var user = list[i];
      var groups = user.groups.join();
      if (groups == '') groups = '<i>no groups</i>';
      //else groups = "Groups: "+groups;
      var icon = user.local ? 'user' : 'peer';
      newhtml += '<tr data-local="'+user.local+'" data-id="'+user.username+'" class="userrow userrow_'+user.username+'"><td><img src="../botmanager/asset/botmanager/'+icon+'_icon.png" width="20" height="20"></td><td>'+user.displayname+' ('+user.username+')'+'</td><td>'+groups+'</td></tr>';
      
      if (user.local) {
        userhtml += newhtml;
        users[user.username] = user;
      }
      else {
        devicehtml += newhtml;
        devices[user.username] = user;
      }
    }
    userhtml += '</table>';
    
    function clickUserRow(){
      var islocal = $(this).data('local');
      var id = $(this).data('id');
      var el = $(ME).find('.edituserpopup');
      var u = (islocal ? users : devices)[id];
      u.cb = function(){
        listUsers();
      };

      var d = {
        cb: function(){
          var el2 = el.find('.allthestuff');
          installControl(el2[0], 'securitybot', 'usercard', function(cardapi){
            el2.find('.usercard-closebutton').click(function(){
              el[0].popup.close(function(){
                el.css('display', 'none');
              });
            });
          }, u);
        }
      };

      installControl(el[0], 'metabot', 'popupdialog', function(popupapi){
        el[0].popup = popupapi;
      }, d);

    }

    var el = $(ME).find('.userlist');
    el[0].users = users;
    el.html(userhtml);
    el.find('.userrow').click(clickUserRow);
    el = $(ME).find('.devicelist');
    el[0].devices = devices;
    el.html(devicehtml);
    el.find('.userrow').click(clickUserRow);
  });
}

function updateDeviceInfo(){
  json('../securitybot/deviceinfo', null, function(result) {
    if (result.status!='ok') alert(result.msg);
    else {
      var b = result.requirepassword == 'true';
      $(ME).find('.requirepasswordswitch').prop('checked', b);
      $(ME).find('.syncapps').css('display', b ? 'block' : 'none');
      b = result.syncapps != 'false';
      $(ME).find('.syncappsswitch').prop('checked', b);
      $(ME).find('.navbar-tab4').css('display', !b ? 'block' : 'none');
    }
  });
}

function setRememberPassword(val, cb){
  json('../securitybot/deviceinfo', 'requirepassword='+val, function(result){
    if (result.status!='ok') alert(result.msg);
    if (cb) cb();
  });
}

function setSyncApps(val, cb){
  json('../securitybot/deviceinfo', 'syncapps='+val, function(result){
    if (result.status!='ok') alert(result.msg);
    if (cb) cb();
  });
}

$(ME).find('.adduserbutton').click(function(){
  var username = encodeURIComponent($(ME).find('.newusername').val());
  json("../securitybot/newuser", "username="+username, function(result){
    if (result.status=='ok'){
      listUsers();
    }
    else alert(result.msg);
  });	
});

$(ME).find('.requirepasswordswitch').change(function(){
  var b = $(this).prop('checked');
  setRememberPassword(b, updateDeviceInfo);
});

$(ME).find('.syncappsswitch').change(function(){
  var b = $(this).prop('checked');
  setSyncApps(b, updateDeviceInfo);
});