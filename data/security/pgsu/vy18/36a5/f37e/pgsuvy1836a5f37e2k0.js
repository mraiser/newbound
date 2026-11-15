var me = this;
var ME = document.getElementById(me.UUID);

// A user saved with no groups loads back from its .properties file as one
// empty-string group; treat that as no groups everywhere.
function cleanGroups(list) {
  return (list || []).filter(function(g) { return g != null && g !== ''; });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function setPower(b) {
  ME.querySelector('.sec-main').classList.toggle('sec-on', b);
  ME.querySelector('.sec-power-title').textContent = b ? 'Security is on' : 'Security is off';
  ME.querySelector('.sec-power-desc').textContent = b
    ? 'Sign-in is required, and each user reaches only what their groups allow.'
    : 'Anyone who can reach this device can use every app and command without signing in. Users can only be managed while security is on.';
}

me.newgroups = [];

me.uiReady = function(ui) {
  me.ui = ui;
  ME.querySelector('.wrap').style.display = 'flex';

  json('../app/settings', null, function(result) {
    if (result.status != 'ok') alert(JSON.stringify(result.msg));
    else {
      var b = result.data.security;
      var sw = ME.querySelector('#security-power-switch');
      sw.checked = b;
      setPower(b);
      sw.addEventListener('change', function() {
        b = this.checked;
        result.data.security = b;
        json('../app/settings', "settings=" + encodeURIComponent(JSON.stringify(result.data)), function(result) {
          if (result.status != 'ok') alert(result.msg);
          else {
            setPower(b);
            if (b) me.buildUsers();
          }
        });
      });
      if (b) me.buildUsers();
    }
  });

  ME.querySelector('#userfilterselect').addEventListener('change', applyFilter);
  me.loadGroups();
};

me.loadGroups = function(cb) {
  send_groups(function(result) {
    if (result.status != 'ok') alert(result.msg);
    else {
      me.groups = cleanGroups(result.data);
      me.groups.sort();
      var sel = ME.querySelector('#userfilterselect');
      var val = sel.value;
      var newhtml = '<option value="">All groups</option>';
      for (var i in me.groups) {
        newhtml += '<option value="' + esc(me.groups[i]) + '">' + esc(me.groups[i]) + '</option>';
      }
      sel.innerHTML = newhtml;
      sel.value = me.groups.indexOf(val) != -1 ? val : '';
      if (cb) cb();
    }
  });
};

// Device accounts (other Newbound peers) have a 36-character UUID as their ID.
function isDevice(id) { return id.length == 36; }

// What the built-in groups allow. Any other group reaches whatever commands and
// apps list it among their groups.
var GROUPDESC = {
  admin: 'Full access to everything on this device.',
  update: 'Can download library updates from this device.',
  anonymous: 'What everyone can reach, even without signing in.'
};
// Always listed in the dialog, in this order, whether or not anyone has them.
var BUILTIN = ['admin', 'update', 'anonymous'];
var CUSTOMDESC = 'Reaches the commands and apps that list this group.';

function inFilter(id) {
  var val = ME.querySelector('#userfilterselect').value;
  var g = me.users[id].groups;
  return val == '' || g.indexOf(val) != -1 || (g.length == 0 && val == 'anonymous');
}

function rowHtml(id) {
  var user = me.users[id];
  var groups = user.groups.length ? esc(user.groups.join(', ')) : '<span class="ut-none">no groups</span>';
  var dev = isDevice(id);
  return '<div tabindex="0" role="button" data-id="' + esc(id) + '" class="userrow">'
    + '<img class="ut-icon" src="../app/asset/app/icons/ui/dark/' + (dev ? 'peer' : 'user') + '.svg" alt="">'
    + '<div><div class="ut-name">' + esc(user.displayname) + '</div><div class="ut-id">' + esc(id) + '</div></div>'
    + '<div class="ut-groups">' + groups + '</div></div>';
}

function renderList(which, ids, total) {
  var html = '';
  for (var i in ids) html += rowHtml(ids[i]);
  if (!ids.length) {
    var msg = total ? 'None in this group.'
      : which == 'people' ? 'No people yet. Add one above.' : 'No devices yet. Pair one in the Peers app.';
    html = '<div class="sec-empty-list">' + msg + '</div>';
  }
  ME.querySelector('.ut-rows[data-list="' + which + '"]').innerHTML = html;
  ME.querySelector('.sec-section-count[data-count="' + which + '"]').textContent = ids.length == total ? total : ids.length + ' of ' + total;
}

function applyFilter() {
  var ids = Object.keys(me.users || {});
  ids.sort(function(a, b) {
    var x = String(me.users[a].displayname).toLowerCase(), y = String(me.users[b].displayname).toLowerCase();
    return x < y ? -1 : x > y ? 1 : a < b ? -1 : 1;
  });
  var people = ids.filter(function(id) { return !isDevice(id); });
  var devices = ids.filter(isDevice);
  renderList('people', people.filter(inFilter), people.length);
  renderList('devices', devices.filter(inFilter), devices.length);
  ME.querySelectorAll('.userlist .userrow').forEach(function(row) {
    row.addEventListener('keydown', function(e) {
      if (e.key == 'Enter' || e.key == ' ') { e.preventDefault(); this.click(); }
    });
    row.addEventListener('click', openUser);
  });
}

function openUser(e) {
  var id = this.dataset.id;
  me.selecteduser = id;
  var user = me.users[id];
  var dev = isDevice(id);
  ME.querySelector('.usercard').classList.toggle('sec-device', dev);
  ME.querySelector('.usercard-title').textContent = dev ? 'Edit device' : 'Edit user';
  ME.querySelector('.usercard-header-text').textContent = id;
  ME.querySelector('.usercard-displayname').value = user.displayname;
  ME.querySelector('.usercard-password').value = user.password;
  ME.querySelector('.usercard-newgroupname').value = '';
  me.newgroups = [];

  buildGroupList(user.groups);

  document.body.api.ui.popup({
    modal: true,
    clientY: e.clientY,
    clientX: e.clientX,
    closeselector: '.usercard-cancel',
    selector: '.usercard'
  });
}

me.buildUsers = function(cb) {
  send_users(function(result) {
    if (result.status != 'ok') alert(result.msg);
    else {
      me.users = result.data;
      for (var id in me.users) me.users[id].groups = cleanGroups(me.users[id].groups);
      applyFilter();
      if (cb) cb();
    }
  });
};

// The built-in groups first, then every other group in use (A-Z), then any
// group just added here.
function buildGroupList(checked) {
  var all = BUILTIN.slice();
  var add = function(g) { if (all.indexOf(g) == -1) all.push(g); };
  me.groups.filter(function(g) { return me.newgroups.indexOf(g) == -1; }).sort().forEach(add);
  checked.slice().sort().forEach(add);
  me.newgroups.forEach(add);
  var html = '';
  for (var i in all) {
    var group = all[i];
    var isnew = me.newgroups.indexOf(group) != -1;
    var desc = isnew ? 'New. Kept when you save.' : (GROUPDESC[group] || CUSTOMDESC);
    html += '<label class="plaincheckbox sec-gopt"><input data-id="' + esc(group) + '" class="groupcheckbox" type="checkbox"' + (checked.indexOf(group) != -1 ? ' checked' : '') + '>'
      + '<span class="sec-gname">' + esc(group) + '</span>'
      + '<span class="sec-gdesc' + (isnew ? ' sec-new' : '') + '">' + esc(desc) + '</span></label>';
  }
  ME.querySelector('.usercard-grouplist').innerHTML = html;
}

function checkedGroups() {
  var groups = [];
  ME.querySelectorAll('.groupcheckbox').forEach(function(box) {
    if (box.checked) groups.push(box.dataset.id);
  });
  return groups;
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
  user.groups = checkedGroups();
  user.displayname = ME.querySelector('.usercard-displayname').value;
  user.password = ME.querySelector('.usercard-password').value;
  // keepalive, address, port: null leaves a peer's stored values unchanged.
  send_setuser(id, user.displayname, user.password, user.groups, null, null, null, function(result) {
    me.loadGroups(function() { me.buildUsers(); });
  });
});

ME.querySelector('.usercard-delete').addEventListener('click', function() {
  var id = me.selecteduser;
  if (id == 'admin') document.body.api.ui.snackbar({message:"You can't delete the admin user"});
  else {
    send_deleteuser(id, function(result) {
      if (result.status != 'ok') alert(result.msg);
      else {
        me.loadGroups(function() { me.buildUsers(); });
        var closebtn = ME.querySelector('.usercard-closebutton');
        if (closebtn) closebtn.click();
      }
    });
  }
});

function addUser() {
  var input = ME.querySelector('.newusername');
  var name = input.value;
  var b = validateName(name);
  if (!b) document.body.api.ui.snackbar({message:'Invalid user name: use lowercase letters, digits and _'});
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
        send_setuser(name, user.displayname, user.password, user.groups, null, null, null, function(result) {
          input.value = '';
          ME.querySelector('#userfilterselect').value = '';
          me.buildUsers(function() {
            var row = ME.querySelector('.userrow[data-id="' + name + '"]');
            if (row) row.click();
          });
        });
      });
    }
  }
}
ME.querySelector('.adduserbutton').addEventListener('click', addUser);
ME.querySelector('.newusername').addEventListener('keydown', function(e) {
  if (e.key == 'Enter') addUser();
});

function addGroup() {
  var input = ME.querySelector('.usercard-newgroupname');
  var name = input.value;
  var b = validateName(name);
  if (!b) document.body.api.ui.snackbar({message:'Invalid group name: use lowercase letters, digits and _'});
  else {
    if (me.groups.indexOf(name) != -1) {
      document.body.api.ui.snackbar({message:'That group already exists'});
    }
    else {
      var checked = checkedGroups();
      me.groups.push(name);
      me.newgroups.push(name);
      checked.push(name);
      buildGroupList(checked);
      input.value = '';
      var list = ME.querySelector('.usercard-grouplist');
      list.scrollTop = list.scrollHeight;
    }
  }
}
ME.querySelector('.addgroupbutton').addEventListener('click', addGroup);
ME.querySelector('.usercard-newgroupname').addEventListener('keydown', function(e) {
  if (e.key == 'Enter') addGroup();
});
