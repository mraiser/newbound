var me = this;
var ME = $('#'+me.UUID)[0];

me.mdb = ME.DATA.mdb ? ME.DATA.mdb : 'runtime';
me.mid = ME.DATA.mid ? ME.DATA.mid : 'threejs_modellist';

me.ready = function(){
  //componentHandler.upgradeAllRegistered();
  
  var el = $(ME).find('.matrixviewer');
  el.data('orbitcontrols', true);
  el.data('showdatgui', true);
  installControl(el[0], 'threejs', 'viewer', function(api){
    me.viewer = api;
    api.waitReady(function(){
      var el = $(ME).find('.libraryselect');
      var data = {
        allowadd:true,
        ready: function(api){
          selectLibrary(api.value());
        },
        cb: function(val){
          selectLibrary(val);
        }
      };
      installControl(el[0], 'metabot', 'libraryselect', function(api){
        sideshow('side_libselect');
      }, data);
    });
  }, {});
};

function sideshow(claz){
  $(ME).find('.ssselected').animate({left:"-100%"},500);
  $(ME).find('.'+claz).addClass('ssselected').animate({left:"0px"},500);
}

function selectLibrary(val){
  me.mdb = val;
  var data = {
    mdb: me.mdb,
    mid: me.mid,
    ready: function(api){},
    cb: function(val){
      selectModel(val);
    }
  };
  var el = $(ME).find('.modellist');
  installControl(el[0], 'threejs', 'modellist', function(api){
    me.modellist = api;
  }, data);
}

function rebuildModel(){
  if (me.modelapi) {
      me.viewer.removeModel(me.modelapi);
  }
  var el = $(ME).find('.loadmodel');
  el.data('metadata', me.model);
  var assets = me.model.assets;
  me.viewer.loadModel(el[0], assets, {list:['threejs:poseanimation']}, null, null, null, null, function(model){
    me.modelapi = me.viewer.modelapi = model;
  });
}

function selectModel(val){
  me.model = val;
  var data = {
    model: val,
    cb: function(val, skiprebuild){
      me.modellist.saveModels();
      if (!skiprebuild) rebuildModel();
    }, 
    viewer:me.viewer
  };
  var el = $(ME).find('.side_editmodel');
  installControl(el[0], 'threejs', 'modeleditor', function(api){
    me.modeleditor = api;
    sideshow('side_editmodel');
    el.find('.closeeditmodelbutton').click(function(){
      sideshow('side_libselect');
    });
  }, data);
  rebuildModel();
}

$(document).click(function(event){
  window.lastElementClicked = event.target;
});
