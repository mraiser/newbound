var me = this; 
var ME = $('#'+me.UUID)[0];

var mname = me.modelid = ME.id;

var set = this.models = [];
$(ME).data('models', set);

var helpset = [];
var scaleVal = 3;

var datGUI = me.datgui = $(ME).data('datgui');
var scene = me.scene = $(ME).data('scene');
var group = me.group = $(ME).data('group');
var db = me.db = $(ME).data('db');
var animations = me.animations = [];

var files = $(ME).data('assets');
if (files && files.list) files = files.list;

var rig = me.rig = new function(){
  this.speed  = 0.25;

  var pos = $(ME).data('pos');
  var rot = $(ME).data('rot');
  var scale = $(ME).data('scale');
  
  this.pos_x = pos ? pos.x : ME.DATA.pos ? ME.DATA.pos.x : 0;
  this.pos_y = pos ? pos.y : ME.DATA.pos ? ME.DATA.pos.y : 0;
  this.pos_z = pos ? pos.z : ME.DATA.pos ? ME.DATA.pos.z : 0;

  this.rot_x = rot ? rot.x : ME.DATA.rot ? ME.DATA.rot.x : 0;
  this.rot_y = rot ? rot.y : ME.DATA.rot ? ME.DATA.rot.y : 0;
  this.rot_z = rot ? rot.z : ME.DATA.rot ? ME.DATA.rot.z : 0;

  this.scale_x = scale ? scale.x : ME.DATA.scale ? ME.DATA.scale.x : 1;
  this.scale_y = scale ? scale.y : ME.DATA.scale ? ME.DATA.scale.y : 1;
  this.scale_z = scale ? scale.z : ME.DATA.scale ? ME.DATA.scale.z : 1;
};

me.onload = function(cb){
  me.onloadcb = cb;
  me.checkIfDone();
};

me.checkIfDone = function(){
  if (me.onloadcb && (!files || files.length == me.models.length)) {
    me.onloadcb(me);
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
  
  for (var i in files) {
    var ci = files[i].indexOf(':');
    var mdb = ci == -1 ? db : files[i].substring(0, ci);
    var mfi = ci == -1 ? files[i] : files[i].substring(ci+1);
    loader.load('../botmanager/asset/'+mdb+'/'+mfi, addModel);
  }
};

function addModel( geometry,  materials ){
  var set = me.models;
  var i = set.length;

  if (materials){
    var x = materials.length;
    while (x-->0) materials[x].skinning = true;
  }
  
  
  var cs = scaleVal;
  
  set[i]= new THREE.SkinnedMesh( geometry, new THREE.MeshFaceMaterial(materials) );
  set[i].castShadow = true;
  set[i].receiveShadow = true;
  
//  rig.pos_y = -cs/1.2;
  
  if (group) group.add(set[i]);
  else scene.add(set[i]);
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

  if (!rig.ignore) {
    if (group){
      group.position.set(rig.pos_x,rig.pos_y,rig.pos_z);
      group.rotation.set(rig.rot_x,rig.rot_y,rig.rot_z);
      group.scale.set(rig.scale_x,rig.scale_y,rig.scale_z);
    }
    
    for (var i in set){
      var child = set[i];
      
      if (!group){
        child.position.set(rig.pos_x,rig.pos_y,rig.pos_z);
        child.rotation.set(rig.rot_x,rig.rot_y,rig.rot_z);
        child.scale.set(rig.scale_x,rig.scale_y,rig.scale_z);
      }
      
      if (child.skeleton) for (var j in child.skeleton.bones) {
        var b = child.skeleton.bones[j];
        b.rotation.x = rig[b.name+'_x'];
        b.rotation.y = rig[b.name+'_y'];
        b.rotation.z = rig[b.name+'_z'];
      }
    }
  }
}
me.render = render;

me.mousedown = function(event){
  if (me.api && me.api.mousedown) return me.api.mousedown(event);
  else if (me.parent && me.parent.mousedown) return me.parent.mousedown(event);
};

me.mousemove = function(event){
  if (me.api && me.api.mousemove) return me.api.mousemove(event);
  else if (me.parent && me.parent.mousemove) return me.parent.mousemove(event);
};

me.mouseup = function(event){
  if (me.api && me.api.mouseup) return me.api.mouseup(event);
  else if (me.parent && me.parent.mouseup) return me.parent.mouseup(event);
};

me.drag = function(event){
  if (me.api && me.api.drag) return me.api.drag(event);
  else if (me.parent && me.parent.drag) return me.parent.drag(event);
};

me.dragover = function(event, model){
  if (me.api && me.api.dragover) return me.api.dragover(event, model);
  else if (me.parent && me.parent.dragover) return me.parent.dragover(event, model);
};

me.dragoff = function(event){
  if (me.api && me.api.dragoff) return me.api.dragoff(event);
  else if (me.parent && me.parent.dragoff) return me.parent.dragoff(event);
};

me.drop = function(event, model){
  if (me.api && me.api.drop) return me.api.drop(event, model);
  else if (me.parent && me.parent.drop) return me.parent.drop(event, model);
};

me.click = function(event){
  if (me.api && me.api.click) return me.api.click(event);
  else if (me.parent && me.parent.click) return me.parent.click(event);
};

me.dblclick = function(event){
  if (me.api && me.api.dblclick) return me.api.dblclick(event);
  else if (me.parent && me.parent.dblclick) return me.parent.dblclick(event);
};
