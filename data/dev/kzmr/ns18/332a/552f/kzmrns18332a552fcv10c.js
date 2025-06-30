var me = this;
var ME = $('#'+me.UUID)[0];
me.ready = function(){
  var v = ME.DATA.version ? ME.DATA.version : 0;
  $(ME).find('.titlelibname').text(ME.DATA.id+' v'+v);
  buildGroups();
  buildControls();
  buildAssets();
  document.body.api.ui.initTooltips(ME);
  var el = $(ME).find('.libsettingswrap')[0];
  installControl(el, 'dev', 'libsettings', function(result){}, ME.DATA);
};
$(ME).find('.rebuildlib').click(function(e){
  document.body.api.ui.snackbarMsg('Rebuilding library '+ME.DATA.id);
  json('../dev/rebuild_lib', 'lib='+ME.DATA.id, function(result){
    document.body.api.ui.snackbarMsg('Library '+ME.DATA.id+' rebuilt');
  });
});
$(ME).find('.deletelibrarybutton').click(function(e){
  var data = {
    title:'Delete Library',
    text:'Are you sure you want to delete this library? This cannot be undone.',
    "clientX":e.clientX,
    "clientY":e.clientY,
    cancel:'Cancel',
    ok:'Delete',
    cb: function(confirmed){
      if (confirmed) {
        var args = {lib:ME.DATA.id};
        json('../app/deletelib', 'lib='+encodeURIComponent(ME.DATA.id), function(result){
          window.location.href = 'dev.html';
        });
      }
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
      var deleteButton = `<button class="deleteasseticon tooltip" data-tooltip='{"message":"Delete Asset"}'><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg></button>`;
      newhtml += '<tr data-assitem="'+ctl+'" class="assrow"><td style="width:100%;">'+clickme+'</td><td style="text-align:right;">'+deleteButton+'</td></tr>';
    }
    $(ME).find('.assetsbody').html(newhtml);
    document.body.api.ui.initTooltips(ME); // Re-init tooltips for new buttons
    $(ME).find('.assrow').find('.deleteasseticon').click(function(e){
      var id = $(this).closest('.assrow').data('assitem');
      var data = {
        title:'Delete Asset',
        text:'Are you sure you want to delete this Asset? This cannot be undone.',
        "clientX":e.clientX,
        "clientY":e.clientY,
        cancel:'Cancel',
        ok:'Delete',
        cb: function(confirmed){
          if (confirmed) {
              json('../botmanager/asset', 'db='+encodeURIComponent(ME.DATA.id)+'&name='+encodeURIComponent(id)+'&delete=true', function(result){
                if (result.status != 'ok') alert('ERROR: '+result.msg);
                else {
                  buildAssets(); // Rebuild the list from server
                }
              });
          }
        }
      };
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
    "ok":"Add",
    "cancel":"Cancel",
    "clientX":e.clientX,
    "clientY":e.clientY,
    "validate":function(name) {
      if (validateName(name)) {
        if (me.controls && me.controls.list && getByProperty(me.controls.list, 'name', name) != null) {
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
    if (!me.controls || !me.controls.list) me.controls = { list: [] };
    me.controls.list.sort(function(a,b) {return (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0);} );
    var newhtml = '';
    for (var i in me.controls.list){
      var ctl = me.controls.list[i];
      var clickme = '<a class="previewctl" href="../dev/preview.html?lib='+db+'&id='+ctl.id+'" target="_blank">'+ctl.name+'</a>';
      var editButton = `<button class="editctlicon tooltip" data-tooltip='{"message":"Edit Control"}'><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg></button>`;
      newhtml += '<tr data-ctlitem="'+ctl.id+'" class="ctlrow"><td style="width:100%;">'+clickme+'</td><td style="text-align:right;">'+editButton+'</td></tr>';
    }
    $(ME).find('.controlsbody').html(newhtml);
    document.body.api.ui.initTooltips(ME);
    $(ME).find('.editctlicon').click(function(){
      window.location.href = '../dev/editcontrol.html?lib='+db+'&id='+$(this).closest('.ctlrow').data('ctlitem');
    });
  });
}
function buildGroups(){
  var newhtml = '';
  if (ME.DATA.readers) {
    for (var i in ME.DATA.readers){
      var g = ME.DATA.readers[i];
      newhtml += '<span class="chip">'+g+'<button class="chipbutton groupdelete"><svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke-width="3" stroke="white" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></span>';
    }
  }
  
  $(ME).find('.groupchips').html(newhtml).find('.groupdelete').click(function(){
    var groupName = $(this).parent().contents().filter(function() { return this.nodeType === 3; }).text().trim();
    var i = ME.DATA.readers.indexOf(groupName);
    ME.DATA.readers.splice(i,1);
    buildGroups();
    saveGroups();
  });

  var addButton = '<button id="groupmenu" class="tooltip" data-tooltip=\'{"message":"Add Group"}\'><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3.5 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-6.5 2a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm11-1a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path></svg></button>';
  $(ME).find('.groupchips').append(addButton);
  document.body.api.ui.initTooltips(ME);

  json('../securitybot/listgroups', null, function(result){
    var menuItems = '';
    for (var i in result.data){
      menuItems += '<div class="group-menu-item addgroup">'+result.data[i]+'</div>';
    }
    $(ME).find('.group-menu-items').html(menuItems);
    
    $(ME).find('.addgroup').click(function(){
      if (! ME.DATA.readers)  ME.DATA.readers = [];
      var groupName = $(this).text();
      var i = ME.DATA.readers.indexOf(groupName);
      if (i == -1)  {
        ME.DATA.readers.push(groupName);
        buildGroups();
        saveGroups();
      }
      document.body.api.ui.closePopup({selector: ".groupmenupopup"});
    });
  });

  $(ME).find('#groupmenu').click(function(e){
    var popupData = {
        selector: '.groupmenupopup',
        clientX: e.clientX,
        clientY: e.clientY
    };
    document.body.api.ui.popup(popupData);
  });
}
function saveControls(){
  var ctl = me.controls;
  var readers = [ "anonymous" ];
  json('../app/write', 'lib='+encodeURIComponent(ME.DATA.id)+'&id=controls&writers=[]&readers='+encodeURIComponent(JSON.stringify(readers))+'&data='+encodeURIComponent(JSON.stringify(ctl)), function(result){
    if (result.status != 'ok') alert(result.msg);
    else {
      buildControls();
    }
  });
}
function saveGroups(){
    // This function will be called by libsettings.js
    var el = $(ME).find('.libsettingswrap')[0];
    if (el.api && el.api.save) {
        el.api.save();
    }
}
