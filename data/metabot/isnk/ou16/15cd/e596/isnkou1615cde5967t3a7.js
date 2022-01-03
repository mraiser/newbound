var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  componentHandler.upgradeAllRegistered();
};

function send_build(data, cb){
  var args = {data: data};
  args = encodeURIComponent(JSON.stringify(args));
  json('../botmanager/execute', 'db=metabot&id=vuoqjj1615ce507a3i410&args='+args, function(result){
    cb(result);
  });
}

function send_package(data, cb){
  var args = {data: data};
  args = encodeURIComponent(JSON.stringify(args));
  json('../botmanager/execute', 'db=metabot&id=nnmxis1664f8be389zd4&args='+args, function(result){
    cb(result);
  });
}

$(ME).find('.step1button').click(function(){
  $(ME).find('.bjpanel').css('display', 'none');
  $(ME).find('#bjstep1').css('display', 'block');
});

$(ME).find('.step2button').click(function(){
  $(ME).find('.bjpanel').css('display', 'none');
  $(ME).find('#bjstep2').css('display', 'block');
});

$(ME).find('.step3button').click(function(){
  $(ME).find('.bjpanel').css('display', 'none');
  $(ME).find('#bjstep3').css('display', 'block');
  

  var CURAPPS = [];
  $(ME).find('.pubappid.is-selected').each(function(x,y){
    var id = y.id.substring(9);
    var app = getByProperty(me.apps, 'id', id);
    CURAPPS.push(app.class);
//    for (var i in app.libraries) if (CURLIBS.indexOf(app.libraries[i]) == -1) CURLIBS.push(app.libraries[i]);
  });  

  var CURLIBS = [];
  $(ME).find('.publibid.is-selected').each(function(x,y){
    var id = y.id.substring(9);
    CURLIBS.push(id);
  });  

  var data = {};
      
  data.apps = CURAPPS;
  data.libs = CURLIBS;
  data.default = $(ME).find('.pubappstartupselect').find('select').val();
  data.port = $('#pubapphttpport').val();
  data.name = $('#pubappname').val();
  data.icon = $('#thevalue').val();
  data.native = $('#pubappnative').prop('checked');
                                 
  function handle(result){
    if (result.status == 'ok') $('#bjstep3').html('Your executable source archive has been built: <a data-role="none" data-ajax="false" target="_blank" href="'+result.data.jar+'?id='+guid()+'">download</a><br><br><a data-ajax="false" data-role="button" data-theme="b" href="index.html">DONE</a>').trigger("create");
    else $('#bjstep3').html('<font color="red">ERROR: '+result.msg+'</font>');
    
    if (data.native){
      $('#bjstep3').prepend('Your native app has been built: <a data-role="none" data-ajax="false" target="_blank" href="'+result.data.app+'?id='+guid()+'">download</a><br>');
    }
  };
  
  if (data.native) send_package(data, handle);
  else send_build(data, handle);
});

me.setApps = function(apps){
  apps.label = 'Startup App';
  installControl($(ME).find('.pubappstartupselect')[0], 'metabot', 'select', function(){}, apps);

  me.appdata = apps;
  me.apps = [];
  for (var i in apps.list) me.apps.push(apps.list[i]);
  me.apps.sort(function(a,b) {return (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0);} ); 
  buildApps(me.apps);
  if (me.libs) init();
};

function buildApps(apps){
  var newhtml = '<table class="mdl-data-table mdl-js-data-table mdl-data-table--selectable mdl-shadow--2dp inline"><thead><tr><th class="mdl-data-table__cell--non-numeric">Apps</th></tr></thead><tbody class="publish-applist">';
  for (var i in apps){
    var app = apps[i];
    newhtml += '<tr id="pubappid_'+app.id+'" class="pubappid"><td class="mdl-data-table__cell--non-numeric">'
      + app.name
      + '</td></tr>';
  }
  newhtml += '</tbody></table>';
  
  $(ME).find('.publish-apptable').html(newhtml).on('change', appclick);
  componentHandler.upgradeAllRegistered();
}

function appclick(e){
  init();
  
  $(ME).find('.pubappid.is-selected').each(function(x,y){
  var id = y.id.substring(9);
  var app = getByProperty(me.apps, 'id', id);
    for (var i in app.libraries){
      var el = $('#publibid_'+app.libraries[i]).find('.mdl-checkbox');
      el.closest('tr').addClass('is-selected');
      el[0].MaterialCheckbox.check();
    }
  });
}

me.setLibs = function(libs){
  me.libs = libs;
  buildLibs(libs);
  if (me.apps) init();
};

function buildLibs(libs){
  var newhtml = '<table class="mdl-data-table mdl-js-data-table mdl-data-table--selectable mdl-shadow--2dp inline"><thead><tr><th class="mdl-data-table__cell--non-numeric">Libraries</th></tr></thead><tbody class="publish-liblist">';
  for (var i in libs){
    var lib = libs[i];
    newhtml += '<tr id="publibid_'+lib.id+'" class="publibid"><td class="mdl-data-table__cell--non-numeric">'
      + lib.name
      + '</td></tr>';
  }
  newhtml += '</tbody></table>';
  
  $(ME).find('.publish-libtable').html(newhtml).on('change', libclick);
  componentHandler.upgradeAllRegistered();
}

function libclick(e){
  init();
  
  $(ME).find('.publibid').each(function(x,y){
    if (!$(y).hasClass('is-selected')){
      var id = y.id.substring(9);
      var lib = getByProperty(me.libs, 'id', id);
      
      for (var i in lib.apps){
        var el = $('#pubappid_'+lib.apps[i]).find('.mdl-checkbox');
        el.closest('tr').removeClass('is-selected');
        el[0].MaterialCheckbox.uncheck();
      }
    }
  });
}

function init(){
  
  for (var i in me.apps){
    var app = me.apps[i];
    for (var j in app.libraries){
      var lib = getByProperty(me.libs, 'id', app.libraries[j]);
      if (lib){
        if (!lib.apps) lib.apps = [];
        if (lib.apps.indexOf(app.id) == -1) lib.apps.push(app.id);
      }
    }
  }
  
  var el = $('#pubappid_botmanager').find('.mdl-checkbox');
  el.closest('tr').addClass('is-selected');
  el[0].MaterialCheckbox.check();
  
  el = $('#pubappid_metabot').find('.mdl-checkbox');
  el.closest('tr').addClass('is-selected');
  el[0].MaterialCheckbox.check();
  
  el = $('#pubappid_securitybot').find('.mdl-checkbox');
  el.closest('tr').addClass('is-selected');
  el[0].MaterialCheckbox.check();
  
  el = $('#pubappid_peerbot').find('.mdl-checkbox');
  el.closest('tr').addClass('is-selected');
  el[0].MaterialCheckbox.check();
  
  el = $('#publibid_peerbot').find('.mdl-checkbox');
  el.closest('tr').addClass('is-selected');
  el[0].MaterialCheckbox.check();
  
  el = $('#publibid_securitybot').find('.mdl-checkbox');
  el.closest('tr').addClass('is-selected');
  el[0].MaterialCheckbox.check();
  
  el = $('#publibid_botmanager').find('.mdl-checkbox');
  el.closest('tr').addClass('is-selected');
  el[0].MaterialCheckbox.check();
  
  el = $('#publibid_metabot').find('.mdl-checkbox');
  el.closest('tr').addClass('is-selected');
  el[0].MaterialCheckbox.check();
  
  el = $('#publibid_flow').find('.mdl-checkbox');
  el.closest('tr').addClass('is-selected');
  el[0].MaterialCheckbox.check();
  
//  el = $('#publibid_Koreapps').find('.mdl-checkbox');
//  el.closest('tr').addClass('is-selected');
//  el[0].MaterialCheckbox.check();
  
//  el = $('#publibid_dashboard').find('.mdl-checkbox');
//  el.closest('tr').addClass('is-selected');
//  el[0].MaterialCheckbox.check();
  
  el = $('#publibid_threejs').find('.mdl-checkbox');
  el.closest('tr').addClass('is-selected');
  el[0].MaterialCheckbox.check();
}

$(ME).find('.assetpickerbutton').click(function(event) {
  data = {
  };
  installControl($(ME).find('.assetpicker')[0], 'metabot', 'assetselect', function(api){
    me.picker = api;    
    installControl($(ME).find('.popmeup')[0], 'metabot', 'popupdialog', function(api){}, {});
  }, data);
});

me.select = function(){
  var lib = me.picker.lib;
  var val = me.picker.value();
  var url = lib+':'+val;
  $(ME).find('.thevalue').val(url);
  $(ME).find('.closeme').click();
};

