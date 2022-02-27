var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  if (!document.body.ui)
    installControl($(ME).find('.addui')[0], 'botmanager', 'ui', rebuild, {});
  else
    rebuild();
};

function rebuild(){
  var groups = document.body.localgroups ? document.body.groups : ['admin', 'anonymous'];
  $(ME).find('.usercard-header-text').text(ME.DATA.username);
  $(ME).find('.usercard-displayname').val(ME.DATA.displayname);
  $(ME).find('.usercard-password').val(ME.DATA.password);
  var newhtml = '';
  for (var i=0;i<document.body.localgroups.length;i++){
    var group = document.body.localgroups[i];
    if (group != 'anonymous'){
      var b = ME.DATA.groups.indexOf(group) != -1 ? ' checked' : '';
      newhtml += '<label  class="plaincheckbox"><input class="groupcheckbox groupcheckbox_'+group+'" type="checkbox"'+b+'><span>'+group+'</span></label><br>';
    }
  }
  $(ME).find('.usercard-grouplist').html(newhtml);
}

$(ME).find('.usercard-cancel').click(function(){
  $(ME).find('.usercard-closebutton').click();
});

$(ME).find('.usercard-delete').click(function(){
  json("../securitybot/deleteuser", "username="+ME.DATA.username, function(result){
    if (result.status=='ok'){
      $(ME).find('.usercard-closebutton').click();
      if (ME.DATA.cb) ME.DATA.cb();
    }
    else alert(result.msg);
  });
});

$(ME).find('.addgroupbutton').click(function(){
  var name = $(ME).find('.usercard-newgroupname').val();
  if (document.body.localgroups.indexOf(name) != -1)
    alert('That group already exists');
  else if (name.indexOf(' ') != -1)
    alert('No spaces allowed');
  else if (name == '')
    alert('New group name required');
  else{
    document.body.localgroups.push(name);
    rebuild();
    $(ME).find('.groupcheckbox_'+name).click();
  }
});

$(ME).find('.usercard-save').click(function(){
  var user = ME.DATA;
  var username = encodeURIComponent(user.username);
  var displayname = encodeURIComponent($(ME).find('.usercard-displayname').val());
  var password = encodeURIComponent($(ME).find('.usercard-password').val());
  var list = $(ME).find('.groupcheckbox:checked').parent().find('span').toArray();
  var groups = [];
  for (var i in list) groups.push($(list[i]).text());
  groups = groups.join();
  groups = encodeURIComponent(groups);
  json("../securitybot/updateuser", "username="+username+"&displayname="+displayname+"&password="+password+"&groups="+groups, function(result){
    if (result.status=='ok'){
      $(ME).find('.usercard-closebutton').click();
      if (ME.DATA.cb) ME.DATA.cb();
    }
    else alert(result.msg);
  });
});
