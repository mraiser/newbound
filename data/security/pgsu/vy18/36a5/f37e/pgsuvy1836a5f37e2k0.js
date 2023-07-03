var me = this; 
var ME = $('#'+me.UUID)[0];

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  
  json('../app/settings', null, function(result){
    if (result.status != 'ok') alert(JSON.stringify(result.msg));
    else {
      var b = result.data.security;
      $(ME).find('#security-power-switch').prop('checked', b).change(function(){
        b = $(this).prop('checked');
        result.data.security = b;
        json('../app/settings', "settings="+encodeURIComponent(JSON.stringify(result.data)), function(result){
          if (result.status != 'ok') alert(result.msg); 
          else {
            $(ME).find('.whenon').css('display', b ? 'block' : 'none');
            if (b) me.buildUsers();
          }
        });
      });
      if (b) {
        $(ME).find('.whenon').css('display', 'block');
        me.buildUsers();
      }
    }
  });
  
  send_groups(function(result){
    if (result.status != 'ok') alert(result.msg);
    else {
      me.groups = result.data;
      result.data.sort();
      var newhtml = '<option></option>';
      for (var i in result.data) {
        newhtml += '<option>'+result.data[i]+'</option>';
      }
      $(ME).find('#userfilterselect').html(newhtml).change(applyFilter);
    }
  });
};

function applyFilter(){
  var val = $(ME).find('#userfilterselect').val();
  var listdiv = $('.userlist');
  if (val == '') 
    listdiv.find('.userrow').css('display','table-row');
  else{
    listdiv.find('.userrow').css('display','none');
    var list = me.users;
    for (var i in list){
      var g = list[i].groups;
      if (g.indexOf(val) != -1 || (g.length==0 && val == 'anonymous'))
        listdiv.find('.userrow_'+i).css('display','table-row');
    }
  }
}

me.buildUsers = function(cb){
  send_users(function(result){
    if (result.status != 'ok') alert(result.msg); 
    else {
      me.users = result.data;
      var newhtml = '<table border="0" cellpadding="20" cellspacing="0" class="usertable">';
      var ids = [];
      for (var id in result.data) ids.push(id);
      ids.sort();
      for (var i in ids) {
        var id = ids[i];
        var user = result.data[id];
        var groups = user.groups.join();
        if (groups == '') groups = '<i>no groups</i>';
        var islocal = id.length != 36;
        var icon = islocal ? 'user' : 'peer';
        newhtml += '<tr data-local="'+islocal+'" data-id="'+id+'" class="userrow userrow_'+id+'"><td><img src="../app/asset/app/'+icon+'_icon.png" width="20" height="20"></td><td>'+user.displayname+' ('+id+')'+'</td><td>'+groups+'</td></tr>';
      }
      newhtml += '</table>';
      $(ME).find('.userlist').html(newhtml).find('.userrow').click(function(e){
        var id = $(this).data('id');
        me.selecteduser = id;
        var user = me.users[id];
        me.selectedusergroups = user.groups.slice();
        
        $(ME).find('.usercard-displayname').val(user.displayname);
        $(ME).find('.usercard-password').val(user.password);
        
        buildGroupList(user);
        
        var d = {
          modal: true,
          clientY: e.clientY,
          clientX: e.clientX,
          closeselector: '.usercard-cancel',
          selector: '.usercard'
        };
        document.body.api.ui.popup(d);
      });
      if (cb) cb();
    }
  });
};

function buildGroupList(user){
  var grouplist = '';
  for (var i in me.groups) {
    var group = me.groups[i];
    if (group != 'anonymous' && group != '') {
      var b = user.groups.indexOf(group) != -1 ? ' checked' : '';
      grouplist += '<label  class="plaincheckbox"><input data-id="'+group+'" class="groupcheckbox groupcheckbox_'+group+'" type="checkbox"'+b+'><span>'+group+'</span></label><br>';
    }
  }
  $(ME).find('.usercard-grouplist').html(grouplist);
}

var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';

function validateName(s){
  var i = s.length;
  if (i == 0) return false;
  while (i-->0) if (validchars.indexOf(s.charAt(i)) == -1) return false;
  return true;
}

$(ME).find('.usercard-save').click(function(){
  var id = me.selecteduser;
  var user = me.users[id];
  var groups = [];
  $(ME).find('.groupcheckbox').each(function(){
    if ($(this).prop('checked')) groups.push($(this).data('id'));
  });
  user.groups = groups ;
  user.displayname = $(ME).find('.usercard-displayname').val();
  user.password = $(ME).find('.usercard-password').val();
  send_setuser(id, user.displayname, user.password, user.groups, function(result){
    me.buildUsers(applyFilter);
  });
});

$(ME).find('.usercard-delete').click(function(){
  var id = me.selecteduser;
  if (id == 'admin') document.body.api.ui.snackbar({message:"You can't delete the admin user"});
  else {
    send_deleteuser(id, function(result){
      if (result.status != 'ok') alert(result.msg);
      else {
        me.buildUsers(applyFilter);
        $(ME).find('.usercard-closebutton').click();
      }
    });
  }
});

$(ME).find('.adduserbutton').click(function(){
  var name = $(ME).find('.newusername').val();
  var b = validateName(name);
  if (!b) document.body.api.ui.snackbar({message:'Invalid user name'});
  else {
    if (me.users[name]){
      document.body.api.ui.snackbar({message:'That user already exists'});
    }
    else {
      json('../app/unique_session_id', null, function(result) {
        var user = {
          displayname: name,
          password: result.msg,
          groups: []
        };
        send_setuser(name, user.displayname, user.password, user.groups, function(result){
          me.buildUsers(function(){
            $(ME).find('.userrow_'+name).click();
          });
          $('#userfilterselect').val('');
        });
      });
    }
  }
});

$(ME).find('.addgroupbutton').click(function(){
  var name = $(ME).find('.usercard-newgroupname').val();
  var b = validateName(name);
  if (!b) document.body.api.ui.snackbar({message:'Invalid group name'});
  else {
    if (me.groups.indexOf(name) != -1){
      document.body.api.ui.snackbar({message:'That group already exists'});
    }
    else {
      me.groups.push(name);
      var id = me.selecteduser;
      var user = { groups: me.selectedusergroups };
      user.groups.push(name);
      buildGroupList(user);
    }
  }
});