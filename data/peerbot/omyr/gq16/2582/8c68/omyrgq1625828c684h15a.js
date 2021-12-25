var me = this;
var ME = $('#'+me.UUID)[0];

var mname = me.modelid = ME.id;

var set = this.models = [];
$(ME).data('models', set);

var helpset = [];
var scaleVal = 3;

var datGUI = me.datgui = $(ME).data('datgui');
var scene = me.scene = $(ME).data('scene');
var db = me.db = $(ME).data('db');
var animations = me.animations = [];

var files = $(ME).data('assets');
if (files) files = files.list;

var rig = me.rig = new function(){
  this.speed  = 0.25;

  var pos = $(ME).data('pos');
  var rot = $(ME).data('rot');
  var scale = $(ME).data('scale');
  
  this.pos_x = pos ? pos.x : 0;
  this.pos_y = pos ? pos.y : 0;
  this.pos_z = pos ? pos.z : 0;

  this.rot_x = rot ? rot.x : 0;
  this.rot_y = rot ? rot.y : 0;
  this.rot_z = rot ? rot.z : 0;

  this.scale_x = scale ? scale.x : 1;
  this.scale_y = scale ? scale.y : 1;
  this.scale_z = scale ? scale.z : 1;
};

me.onload = function(cb){
  me.onloadcb = cb;
  me.checkIfDone();
};

me.checkIfDone = function(){
  if (me.onloadcb && files.length == me.models.length) {
    me.onloadcb();
  }
};

me.ready = function(){
  if (datGUI) {
    var cfolder = me.cfolder = me.cfolder ? me.cfolder : datGUI ? datGUI.addFolder(mname) : null;
    $(ME).data('cfolder', cfolder);  

    cfolder.add(rig, 'pos_x',-10, 10);
    cfolder.add(rig, 'pos_y',-10, 10);
    cfolder.add(rig, 'pos_z',-10, 10);
    cfolder.add(rig, 'rot_x',-3.14, 3.14);
    cfolder.add(rig, 'rot_y',-3.14, 3.14);
    cfolder.add(rig, 'rot_z',-3.14, 3.14);
    cfolder.add(rig, 'scale_x',0, 10);
    cfolder.add(rig, 'scale_y',0, 10);
    cfolder.add(rig, 'scale_z',0, 10);
  }

  loader = new THREE.JSONLoader();
  
  if (scene.naughty || $(ME).data('naughty')) {
    var f = [];
    var n;
    for (var i in files) {
      if ((n = files[i].indexOf('-min.json')) != -1) f.push(files[i].substring(0,n)+'.json');
      else if (files[i].indexOf('suit') == -1 && files[i].indexOf('shoes') == -1) f.push(files[i]);
    }
    files = f;
  }
      
  for (var i in files) loader.load('../botmanager/asset/'+db+'/'+files[i], addModel);
};

function addModel( geometry,  materials ){
  var set = me.models;
  var i = set.length;

  materials[0].skinning = true;

  var cs = scaleVal;
  
  set[i]= new THREE.SkinnedMesh( geometry, new THREE.MeshFaceMaterial(materials) );
  set[i].castShadow = true;
  set[i].receiveShadow = true;
  
//  rig.pos_y = -cs/1.2;
  
  scene.add(set[i]);
  helpset[i] = new THREE.SkeletonHelper(set[i]);
  
  if (datGUI){
    var cfolder = me.cfolder;
    for (var j in set[i].skeleton.bones){
      var child = set[i].skeleton.bones[j];
      if (typeof rig[child.name+'_x'] == 'undefined'){
        var n = child.name;

        rig[n+'_x'] = 0.0;
        rig[n+'_y'] = 0.0;
        rig[n+'_z'] = 0.0;
        
        cfolder.add(rig, n+'_x',-3.14, 3.14);
        cfolder.add(rig, n+'_y',-3.14, 3.14);
        cfolder.add(rig, n+'_z',-3.14, 3.14);
      }
    }
  }
  me.checkIfDone();
}

function render() { 
  var now = new Date().getTime();
  for (var i in animations) animations[i](me, now);

  for (var i in set){
    var child = set[i];
    child.position.set(rig.pos_x,rig.pos_y,rig.pos_z);
    child.rotation.set(rig.rot_x,rig.rot_y,rig.rot_z);
    child.scale.set(rig.scale_x,rig.scale_y,rig.scale_z);

    for (var j in child.skeleton.bones) {
      var b = child.skeleton.bones[j];
      b.rotation.x = rig[b.name+'_x'];
      b.rotation.y = rig[b.name+'_y'];
      b.rotation.z = rig[b.name+'_z'];
    }
    
//    if (me.postrender) me.postrender();
  }
}
me.render = render;
