var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var v = ME.DATA.version ? ME.DATA.version : 0;
  $(ME).find('.titlelibname').text(ME.DATA.id+' v'+v);
  buildGroups();
  buildControls();
  buildAssets();
  setCryptoSwitch();
  componentHandler.upgradeAllRegistered();
};

$(ME).find('.addcontrolbutton').click(function(){
  var data = {
    title:'New Control',
    text:'New Control name',
    subtext:'lowercase letters, numbers, and underscores only.',
    cancel:'cancel',
    ok:'create',
    validate:function(val){
      if (val.length == 0) return false;
      var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';
      var i = val.length;
      while (i-->0) if (validchars.indexOf(val.charAt(i)) == -1) return false;
      return true;
    },
    cb: function(val){
      var ctl = { name: val };
      json('../botmanager/write', 'db='+encodeURIComponent(ME.DATA.id)+'&data='+encodeURIComponent(JSON.stringify(ctl)), function(result){
        if (result.status != 'ok') alert(result.msg);
        else {
          ctl.id = result.id;
          if (!me.controls) me.controls = {};
          if (!me.controls.list) me.controls.list = [];
          me.controls.list.push(ctl);
          saveControls();
        }
      });
    }
  };
  installControl($(ME).find('.dialogdiv')[0], 'metabot', 'promptdialog', function(){}, data);
});

$(ME).find('.addassetbutton').click(function(){
  var db = ME.DATA.id;
  var data = {
    title:'Upload Asset',
    cancel:'cancel',
    ok:'upload',
    lib:db,
    validate:function(val){
      if (val.length == 0) return false;
      return true;
    },
    cb: function(val){
      var ctl = { name: val, id: val };

      if (!me.assets) me.assets = {};
      if (!me.assets.list) me.assets.list = [];
      me.assets.list.push(ctl);
      saveAssets();
    }
  };
  installControl($(ME).find('.dialogdiv')[0], 'metabot', 'uploaddialog', function(){}, data);
});

$(ME).find('.deletelibrarybutton').click(function(){
  var data = {
    title:'Delete Library',
    text:'Are you sure you want to delete this library? This cannot be undone.',
    cancel:'cancel',
    ok:'delete',
    cb: function(){
      var args = {lib:ME.DATA.id};
      json('../metabot/call', 'db=metabot&name=metabot&cmd=deletelibrary&args='+encodeURIComponent(JSON.stringify(args)), function(result){
        $('#libraries-tab')[0].api.ready();
        $(ME).empty();
      });
    }
  };
  installControl($(ME).find('.dialogdiv')[0], 'metabot', 'confirmdialog', function(){}, data);
});

function saveControls(){
  var ctl = me.controls;
  var readers = [ "anonymous" ];
  json('../botmanager/write', 'db='+encodeURIComponent(ME.DATA.id)+'&id=controls&readers='+encodeURIComponent(JSON.stringify(readers))+'&data='+encodeURIComponent(JSON.stringify(ctl)), function(result){
    if (result.status != 'ok') alert(result.msg);
    else {
      buildControls();
    }
  });
}

function saveGroups(){
  if (! ME.DATA.readers)  ME.DATA.readers = [];
  json('../botmanager/convertdb', 'db='+encodeURIComponent(ME.DATA.id)+'&readers='+encodeURIComponent(JSON.stringify(ME.DATA.readers)), function(result){
//    alert(JSON.stringify(result));
  });
}

function buildGroups(){
  var newhtml = '';
  for (var i in ME.DATA.readers){
    var g = ME.DATA.readers[i];
    newhtml += '<span class="mdl-chip mdl-chip--deletable"><span class="mdl-chip__text">'+g+'</span><button type="button" class="groupdelete mdl-chip__action"><i class="material-icons">cancel</i></button></span>';
  }
  $(ME).find('.groupchips').html(newhtml).find('.groupdelete').click(function(){
    var i = ME.DATA.readers.indexOf($(this).prev().text());
    ME.DATA.readers.splice(i,1);
    buildGroups();
    saveGroups();
  });
  json('../securitybot/listgroups', null, function(result){
    newhtml = '<button id="groupmenu" class="mdl-button mdl-js-button mdl-button--icon"><i class="material-icons">group_add</i></button><ul class="mdl-menu mdl-menu--bottom-left mdl-js-menu mdl-js-ripple-effect" for="groupmenu">';
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
    componentHandler.upgradeAllRegistered();
  });
}

function buildControls(){
  var db = ME.DATA.id;
  json('../botmanager/read', 'db='+db+'&id=controls', function(result){
    me.controls = result.data;
    me.controls.list.sort(function(a,b) {return (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0);} ); 
    var newhtml = '';
    for (var i in me.controls.list){
      var ctl = me.controls.list[i];
      var clickme = '<a class="previewctl" href="../metabot/preview.html?db='+db+'&id='+ctl.id+'" target="_blank">'+ctl.name+'</a>';
      newhtml += '<tr data-ctlitem="'+ctl.id+'" class="ctlrow"><td class="mdl-data-table__cell--non-numeric">'+clickme+'</td><td class="mdl-data-table__cell--non-numeric"><i class="editctlicon mdc-list-item__graphic material-icons" aria-hidden="true">edit</i></td></tr>';
    }
    $(ME).find('.controlsbody').html(newhtml);
    $(ME).find('.editctlicon').click(function(){
      window.location.href = '../metabot/editcontrol.html?db='+db+'&id='+$(this).closest('.ctlrow').data('ctlitem');
    });
  });  
}

function saveAssets(){
  var ctl = me.assets;
  var readers = [ "anonymous" ];
  json('../botmanager/write', 'db='+encodeURIComponent(ME.DATA.id)+'&id=assets&readers='+encodeURIComponent(JSON.stringify(readers))+'&data='+encodeURIComponent(JSON.stringify(ctl)), function(result){
    if (result.status != 'ok') alert(result.msg);
    else {
      buildAssets();
    }
  });
}

function buildAssets(){
  var db = ME.DATA.id;
  var args = {lib:db};
  json('../metabot/call', 'db=metabot&name=metabot&cmd=rebuildassets&args='+encodeURIComponent(JSON.stringify(args)), function(result){
    json('../botmanager/read', 'db='+db+'&id=assets', function(result){
      me.assets = result.data;
      me.assets.list.sort(function(a,b) {return (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0);} ); 
      var newhtml = '';
      for (var i in me.assets.list){
        var ctl = me.assets.list[i];
        var clickme = '<a href="../botmanager/asset/'+db+'/'+ctl.id+'" target="_blank">'+ctl.name+'</a>';
        newhtml += '<tr data-assitem="'+ctl.id+'" class="assrow"><td class="mdl-data-table__cell--non-numeric">'+clickme+'</td><td class="mdl-data-table__cell--non-numeric"><i class="mdc-list-item__graphic material-icons" aria-hidden="true">delete</i></td></tr>';
      }
      $(ME).find('.assetsbody').html(newhtml);
      $(ME).find('.assrow').find('.mdc-list-item__graphic').click(function(){
        var id = $(this).closest('.assrow').data('assitem');
        var data = {
          title:'Delete Asset',
          text:'Are you sure you want to delete this Asset? This cannot be undone.',
          cancel:'cancel',
          ok:'delete',
          cb: function(){
//            alert(id);
            
            
            
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
        installControl($(ME).find('.dialogdiv')[0], 'metabot', 'confirmdialog', function(){}, data);
      });
    });  
  });
}

function setCryptoSwitch(){
  if (ME.DATA.encryption != "NONE"){
    var x = $('#cryptoswitch').prop("checked", true).parent()[0];
    if (x.MaterialSwitch) x.MaterialSwitch.checkToggleState();
  }
  $('#cryptoswitch').change(function(){
    var crypto = $('#cryptoswitch').prop("checked") ? "AES" : "NONE";
    json('../botmanager/convertdb', 'db='+encodeURIComponent(ME.DATA.id)+'&encryption='+crypto, function(result){
      if (result.status != 'ok') alert(result.msg);
    });
  });
}




