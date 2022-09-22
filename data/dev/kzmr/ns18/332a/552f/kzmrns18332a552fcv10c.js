var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var v = ME.DATA.version ? ME.DATA.version : 0;
  $(ME).find('.titlelibname').text(ME.DATA.id+' v'+v);
  buildGroups();
  buildControls();
  buildAssets();
};

$(ME).find('.deletelibrarybutton').click(function(e){
  var data = {
    title:'Delete Library',
    text:'Are you sure you want to delete this library? This cannot be undone.',
    "clientX":e.clientX,
    "clientY":e.clientY,
    cancel:'cancel',
    ok:'delete',
    cb: function(){
      var args = {lib:ME.DATA.id};
      json('../app/deletelib', 'lib='+encodeURIComponent(ME.DATA.id), function(result){
        var u = window.location.href;
        window.location.href = u;
      });
    }
  };
  document.body.api.ui.confirm(data);
});

function buildAssets(){
  var db = ME.DATA.id;
  var args = {lib:db};
  json('../app/assets', 'lib='+db, function(result){
    me.assets = result.data;
    me.assets.sort(function(a,b) {return (a.toLowerCase() > b.toLowerCase()) ? 1 : ((b.toLowerCase() > a.toLowerCase()) ? -1 : 0);} ); 
    var newhtml = '';
    for (var i in me.assets){
      var ctl = me.assets[i];
      var clickme = '<a class="previewasset" href="../app/asset/'+db+'/'+ctl+'" target="_blank">'+ctl+'</a>';
      newhtml += '<tr data-assitem="'+ctl+'" class="assrow"><td>'+clickme+'</td><td><img src="../app/asset/app/delete_icon.png" class="deleteasseticon"></td></tr>';
    }
    $(ME).find('.assetsbody').html(newhtml);
    $(ME).find('.assrow').find('.deleteasseticon').click(function(e){
      var id = $(this).closest('.assrow').data('assitem');
      var data = {
        title:'Delete Asset',
        text:'Are you sure you want to delete this Asset? This cannot be undone.',
        "clientX":e.clientX,
        "clientY":e.clientY,
        cancel:'cancel',
        ok:'delete',
        cb: function(){
          json('../botmanager/asset', 'db='+encodeURIComponent(ME.DATA.id)+'&name='+encodeURIComponent(id)+'&delete=true', function(result){
            if (result.status != 'ok') alert('ERROR: '+result.msg);
            else {
              var a = getByProperty(me.assets.list, "id", id);
              var i = me.assets.list.indexOf(a);
              me.assets.list.splice(i,1);
              saveAssets();
            }
          });
        }
      }
	  document.body.api.ui.confirm(data);
    });
  });  
}

var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';

function validateName(s){
  var i = s.length;
  if (i == 0) return false;
  while (i-->0) if (validchars.indexOf(s.charAt(i)) == -1) return false;
  return true;
}

$(ME).find('.addcontrolbutton').click(function(e){
  var d = {
    "title": "New Control",
    "text": "Name",
    "subtext": "Lowercase letters, numbers and underscores only",
    "ok":"add",
    "cancel":"cancel",
    "clientX":e.clientX,
    "clientY":e.clientY,
    "validate":function(name) {
      if (validateName(name)) {
        if (getByProperty(me.controls.list, 'name', name) != null) {
          document.body.api.ui.snackbar({"message": "There is already a control with that name"});
          return false;
        }
        else return true;
      }
      else {
        document.body.api.ui.snackbar({"message": "Invalid characters"});
        return false;
      }
    },
    "cb":function(val){
      var ctl = { name: val, db: ME.DATA.id, lib: ME.DATA.id };
      json('../app/write', 'lib='+encodeURIComponent(ME.DATA.id)+'&writers=[]&readers=[]&data='+encodeURIComponent(JSON.stringify(ctl)), function(result){
        if (result.status != 'ok') alert(result.msg);
        else {
          ctl.ctl = result.id;
          ctl.id = result.id;
	      json('../app/write', 'lib='+encodeURIComponent(ME.DATA.id)+'&id='+encodeURIComponent(result.id)+'&writers=[]&readers=[]&data='+encodeURIComponent(JSON.stringify(ctl)), function(result){
            if (result.status != 'ok') alert(result.msg);
            else {
              if (!me.controls) me.controls = {};
              if (!me.controls.list) me.controls.list = [];
              me.controls.list.push(ctl);
              saveControls();
            }
          });
        }
      });
    }
  };
  document.body.api.ui.prompt(d);
});

function buildControls(){
  var db = ME.DATA.id;
  json('../app/read', 'lib='+db+'&id=controls', function(result){
    me.controls = result.data;
    me.controls.list.sort(function(a,b) {return (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0);} ); 
    var newhtml = '';
    for (var i in me.controls.list){
      var ctl = me.controls.list[i];
      var clickme = '<a class="previewctl" href="../dev/preview.html?lib='+db+'&id='+ctl.id+'" target="_blank">'+ctl.name+'</a>';
      newhtml += '<tr data-ctlitem="'+ctl.id+'" class="ctlrow"><td>'+clickme+'</td><td><img src="../app/asset/app/pencil_icon.png" class="editctlicon"></td></tr>';
    }
    $(ME).find('.controlsbody').html(newhtml);
    $(ME).find('.editctlicon').click(function(){
      window.location.href = '../dev/editcontrol.html?lib='+db+'&id='+$(this).closest('.ctlrow').data('ctlitem');
    });
  });  
}

function buildGroups(){
  var newhtml = '';
  for (var i in ME.DATA.readers){
    var g = ME.DATA.readers[i];
    newhtml += '<span class="chip">'+g+'<img src="../app/asset/app/close-white.png" class="roundbutton-small groupdelete chipbutton"></span>';
  }
  $(ME).find('.groupchips').html(newhtml).find('.groupdelete').click(function(){
    var i = ME.DATA.readers.indexOf($(this).prev().text());
    ME.DATA.readers.splice(i,1);
    buildGroups();
    saveGroups();
  });
  json('../securitybot/listgroups', null, function(result){
    newhtml = '&nbsp;<img src="../app/asset/app/group_add_icon.png" id="groupmenu"><ul class="card popupcard groupmenupopup mdl-menu mdl-menu--bottom-left mdl-js-menu mdl-js-ripple-effect" for="groupmenu">';
    for (var i in result.data){
      newhtml += '<li class="mdl-menu__item addgroup">'+result.data[i]+'</li>';
    }
    newhtml += '</ul>';
    $(ME).find('.groupchips').append(newhtml).find('.addgroup').click(function(){
      if (! ME.DATA.readers)  ME.DATA.readers = [];
      var i = ME.DATA.readers.indexOf($(this).text());
      if (i == -1)  {
        ME.DATA.readers.push($(this).text());
        buildGroups();
        saveGroups();
      }
    });
    $(ME).find('#groupmenu').click(function(){
      $(ME).find('.groupmenupopup').css('display', 'block');
    });

    $(ME).find('.groupmenupopup').mouseleave(function(){
      $(this).css('display','none');
    });
  });
}

function saveControls(){
  var ctl = me.controls;
  var readers = [ "anonymous" ]; // FIXME 
  json('../app/write', 'lib='+encodeURIComponent(ME.DATA.id)+'&id=controls&writers=[]&readers='+encodeURIComponent(JSON.stringify(readers))+'&data='+encodeURIComponent(JSON.stringify(ctl)), function(result){
    if (result.status != 'ok') alert(result.msg);
    else {
      buildControls();
    }
  });
}
