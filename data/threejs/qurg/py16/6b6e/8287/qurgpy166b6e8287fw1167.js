var me = this;
var ME = $('#'+me.UUID)[0];

me.models = [];
me.mdb = ME.DATA.mdb ? ME.DATA.mdb : 'runtime';
me.mid = ME.DATA.mid ? ME.DATA.mid : 'threejs_modellist';

me.ready = function(){
  ///componentHandler.upgradeAllRegistered();
  json('../botmanager/read', 'db='+me.mdb+'&id='+me.mid, function(result){
    if (result.data && result.data.models) me.models = result.data.models;
    rebuildModels();
  });
};

function saveModels(){
  var data = { models: me.models };
  json('../botmanager/write', 'db='+me.mdb+'&id='+me.mid+'&data='+encodeURIComponent(JSON.stringify(data)), function(result){
    rebuildModels();
  });
}
me.saveModels = saveModels;

function rebuildModels(){
  var newhtml = '';
  for (var i in me.models){
    var m = me.models[i];
    newhtml += '<div data-index="'+i+'" class="model-card-image mc'+i+' mdl-card mdl-shadow--2dp" style="background-image:url('+m.thumbnail+');"><div class="mdl-card__title mdl-card--expand"></div><div class="mdl-card__actions selectmodel"><span class="model-card-image__filename">'+m.name+'</span></div><div class="mdl-card__menu"><button class="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect deletemodelbutton"><i class="material-icons">delete</i></button></div></div>';
  }
  var el = $(ME).find('.modellistwrap');
  el.html(newhtml);
  el.find('.deletemodelbutton').click(function(){
    var i = $(this).closest('.model-card-image').data('index');
    var data = {
      title:"Delete Model",
      text:"Are you sure you want to delete this model?",
      cb:function(){
        me.models.splice(i,1);
        saveModels();
      }
    }
    installControl($(ME).find('.killmodelpopup')[0], 'metabot', 'confirmdialog', function(result){}, data);
  });
  el.find('.selectmodel').click(function(){
    var i = $(this).closest('.model-card-image').data('index');
    var m = me.models[i];
    if (ME.DATA.cb) ME.DATA.cb(m);
  });
}

$(ME).find('.addmodel').click(function(){
  var data = {
    id: guid(),
    name: "Untitled",
    lib: me.mdb,
    thumbnail: "../botmanager/asset/threejs/3d.png",
    assets:[]
  };
  me.models.unshift(data);
  saveModels();
  if (ME.DATA.cb) ME.DATA.cb(data);
});

$(document).click(function(event){
  window.lastElementClicked = event.target;
});
