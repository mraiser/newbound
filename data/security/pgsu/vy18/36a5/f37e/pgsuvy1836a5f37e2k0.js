var me = this;
var ME = document.getElementById(me.UUID);

me.uiReady = function(ui) {
  me.ui = ui;
  ME.querySelector('.wrap').style.display = 'block';

  json('../app/settings', null, function(result) {
    if (result.status != 'ok') alert(JSON.stringify(result.msg));
    else {
      var b = result.data.security;
      var sw = ME.querySelector('#security-power-switch');
      sw.checked = b;
      sw.addEventListener('change', function() {
        b = this.checked;
        result.data.security = b;
        json('../app/settings', "settings=" + encodeURIComponent(JSON.stringify(result.data)), function(result) {
          if (result.status != 'ok') alert(result.msg);
          else {
            ME.querySelectorAll('.whenon').forEach(function(el) { el.style.display = b ? 'block' : 'none'; });
            if (b) me.buildUsers();
          }
        });
      });
      if (b) {
        ME.querySelectorAll('.whenon').forEach(function(el) { el.style.display = 'block'; });
        me.buildUsers();
      }
    }
  });

  send_groups(function(result) {
    if (result.status != 'ok') alert(result.msg);
    else {
      me.groups = result.data;
      result.data.sort();
      var newhtml = '<option></option>';
      for (var i in result.data) {
        newhtml += '<option>' + result.data[i] + '</option>';
      }
      var sel = ME.querySelector('#userfilterselect');
      sel.innerHTML = newhtml;
      sel.addEventListener('change', applyFilter);
    }
  });
};

function applyFilter() {
  var val = ME.querySelector('#userfilterselect').value;
  var listdiv = document.querySelector('.userlist');
  if (val == '')
    listdiv.querySelectorAll('.userrow').forEach(function(r) { r.style.display = 'table-row'; });
  else {
    listdiv.querySelectorAll('.userrow').forEach(function(r) { r.style.display = 'none'; });
    var list = me.users;
    for (var i in list) {
      var g = list[i].groups;
      if (g.indexOf(val) != -1 || (g.length == 0 && val == 'anonymous'))
        listdiv.querySelectorAll('.userrow_' + i).forEach(function(r) { r.style.display = 'table-row'; });
    }
  }
}

me.buildUsers = function(cb) {
  send_users(function(result) {
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
        newhtml += '<tr data-local="' + islocal + '" data-id="' + id + '" class="userrow userrow_' + id + '"><td><img src="../app/asset/app/' + icon + '_icon.png" width="20" height="20"></td><td>' + user.displayname + ' (' + id + ')' + '</td><td>' + groups + '</td></tr>';
      }
      newhtml += '</table>';
      var listdiv = ME.querySelector('.userlist');
      listdiv.innerHTML = newhtml;
      listdiv.querySelectorAll('.userrow').forEach(function(row) {
        row.addEventListener('click', function(e) {
          var id = this.dataset.id;
          me.selecteduser = id;
          var user = me.users[id];
          me.selectedusergroups = user.groups.slice();

          ME.querySelector('.usercard-displayname').value = user.displayname;
          ME.querySelector('.usercard-password').value = user.password;

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
      });
      if (cb) cb();
    }
  });
};

function buildGroupList(user) {
  var grouplist = '';
  for (var i in me.groups) {
    var group = me.groups[i];
    if (group != 'anonymous' && group != '') {
      var b = user.groups.indexOf(group) != -1 ? ' checked' : '';
      grouplist += '<label  class="plaincheckbox"><input data-id="' + group + '" class="groupcheckbox groupcheckbox_' + group + '" type="checkbox"' + b + '><span>' + group + '</span></label><br>';
    }
  }
  ME.querySelector('.usercard-grouplist').innerHTML = grouplist;
}

var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';

function validateName(s) {
  var i = s.length;
  if (i == 0) return false;
  while (i-->0) if (validchars.indexOf(s.charAt(i)) == -1) return false;
  return true;
}

ME.querySelector('.usercard-save').addEventListener('click', function() {
  var id = me.selecteduser;
  var user = me.users[id];
  var groups = [];
  ME.querySelectorAll('.groupcheckbox').forEach(function(box) {
    if (box.checked) groups.push(box.dataset.id);
  });
  user.groups = groups;
  user.displayname = ME.querySelector('.usercard-displayname').value;
  user.password = ME.querySelector('.usercard-password').value;
  send_setuser(id, user.displayname, user.password, user.groups, function(result) {
    me.buildUsers(applyFilter);
  });
});

ME.querySelector('.usercard-delete').addEventListener('click', function() {
  var id = me.selecteduser;
  if (id == 'admin') document.body.api.ui.snackbar({message:"You can't delete the admin user"});
  else {
    send_deleteuser(id, function(result) {
      if (result.status != 'ok') alert(result.msg);
      else {
        me.buildUsers(applyFilter);
        var closebtn = ME.querySelector('.usercard-closebutton');
        if (closebtn) closebtn.click();
      }
    });
  }
});

ME.querySelector('.adduserbutton').addEventListener('click', function() {
  var name = ME.querySelector('.newusername').value;
  var b = validateName(name);
  if (!b) document.body.api.ui.snackbar({message:'Invalid user name'});
  else {
    if (me.users[name]) {
      document.body.api.ui.snackbar({message:'That user already exists'});
    }
    else {
      json('../app/unique_session_id', null, function(result) {
        var user = {
          displayname: name,
          password: result.msg,
          groups: []
        };
        send_setuser(name, user.displayname, user.password, user.groups, function(result) {
          me.buildUsers(function() {
            var row = ME.querySelector('.userrow_' + name);
            if (row) row.click();
          });
          dget('userfilterselect').value = '';
        });
      });
    }
  }
});

ME.querySelector('.addgroupbutton').addEventListener('click', function() {
  var name = ME.querySelector('.usercard-newgroupname').value;
  var b = validateName(name);
  if (!b) document.body.api.ui.snackbar({message:'Invalid group name'});
  else {
    if (me.groups.indexOf(name) != -1) {
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
