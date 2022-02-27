var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  if (!document.body.ui)
    installControl($(ME).find('.addui')[0], 'botmanager', 'ui', build, {});
  else
    build();
};

function build(){
  //document.body.ui.initNavbar(ME);
  $(ME).find('.appcard-header-text').text(ME.DATA.name);
  
  var d = {
    label: "Select Command",
    list:[],
    cb:showCommandSecurity,
    ready:showCommandSecurity
  };
  
  for (var cmd in ME.DATA.commands) d.list.push(cmd);
  
  installControl($(ME).find('.appcmdselect')[0], 'metabot', 'select', function(){}, d);
}

function buildCheckboxes(list){
  if (!list) list = [];
  var newhtml = '';
  for (var i=0;i<document.body.localgroups.length;i++){
    var group = document.body.localgroups[i];
    if (group != 'admin'){
      var b = list.indexOf(group) != -1 ? ' checked' : '';
      newhtml += '<label  class="plaincheckbox"><input class="groupcheckbox groupcheckbox_'+group+'" type="checkbox"'+b+'><span>'+group+'</span></label><br>';
    }
  }
  return newhtml;
}

function showAppSecurity(){
  var el = $(ME).find('.appcard-grouplist');
  el.html(buildCheckboxes(ME.DATA.include));
  el.find('.plaincheckbox').change(function(){
    var list = $(ME).find('.groupcheckbox:checked').parent().find('span').toArray();
    var groups = [];
    for (var i in list) groups.push($(list[i]).text());
    ME.DATA.include = groups.join();
    ME.DATA.touched = true;
  });
}

function showCommandSecurity(){
  var cmdid = $(ME).find('.appcmdselect')[0].api.value();
  if (ME.DATA.commands && ME.DATA.commands[cmdid]){
    $(ME).find('.appcard-commandname').text(cmdid);
    var cmdgroups = ME.DATA.commands[cmdid].include;
    var el = $(ME).find('.appcard-grouplist');
    el.html(buildCheckboxes(cmdgroups));
    el.find('.plaincheckbox').change(function(){
      var list = $(ME).find('.groupcheckbox:checked').parent().find('span').toArray();
      var groups = [];
      for (var i in list) groups.push($(list[i]).text());
      var cmd = ME.DATA.commands[cmdid];
      cmd.include = groups.join();
      cmd.touched = true;
    });
  }
  else {
    $(ME).find('.appcard-main').css('display', 'none');
    $(ME).find('.appcard-save').css('display', 'none');
    $(ME).find('.nocommandsmsg').css('display', 'block');
  }
}

$(ME).find('.navbar-tab-app').click(showAppSecurity);
$(ME).find('.navbar-tab-cmd').click(showCommandSecurity);

$(ME).find('.appcard-cancel').click(function(){
  $(ME).find('.appcard-closebutton').click();
});

$(ME).find('.appcard-delete').click(function(){
  json("../securitybot/deleteapp", "appname="+ME.DATA.appname, function(result){
    if (result.status=='ok'){
      $(ME).find('.appcard-closebutton').click();
      if (ME.DATA.cb) ME.DATA.cb();
    }
    else alert(result.msg);
  });
});

$(ME).find('.addgroupbutton').click(function(){
  var name = $(ME).find('.appcard-newgroupname').val();
  if (document.body.localgroups.indexOf(name) != -1)
    alert('That group already exists');
  else if (name.indexOf(' ') != -1)
    alert('No spaces allowed');
  else if (name == '')
    alert('New group name required');
  else{
    document.body.localgroups.push(name);
    showCommandSecurity();
    $(ME).find('.groupcheckbox_'+name).click();
  }
});

$(ME).find('.appcard-save').click(function(){
  var app = ME.DATA;
  var idstr = 'id='+encodeURIComponent(app.id);
  
  var list = [];
  for (var cmdname in app.commands){
    var cmd = app.commands[cmdname];
    if (cmd.touched) {
      cmd.name = cmdname;
      list.push(cmd);
    }
  }
        
  function popNext(){
    if (list.length>0){
      var cmd = list.pop();
      var params = idstr + '&cmd='+ encodeURIComponent(cmd.name) + (cmd.include ? '&include='+encodeURIComponent(cmd.include) : '');
      json("../securitybot/updateapp", params, function(result){
        if (result.status != 'ok') alert(result.msg);
        else popNext();
      });
    }
    else{
      $(ME).find('.appcard-closebutton').click();
      if (ME.DATA.cb) ME.DATA.cb();
    }
  }
                                                               
  if (app.touched){
    var params = idstr + (app.include ? '&include='+encodeURIComponent(app.include) : '');
    //params += app.exclude ? '&exclude='+encodeURIComponent(app.exclude) : '';
    json("../securitybot/updateapp", params, function(result){
      if (result.status != 'ok') alert(result.msg);
      else popNext();
    });
  }
  else popNext();
});
