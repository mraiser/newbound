var me = this; 
var ME = $('#'+me.UUID)[0];

me.modelid = ME.id;

var set = this.models = [];
$(ME).data('models', set);

//var helpset = [];
//var scaleVal = 3;

var datGUI = me.datgui = $(ME).data('datgui');
var scene = me.scene = $(ME).data('scene');
var group = me.group = $(ME).data('group');
var db = me.db = $(ME).data('db');
var animations = me.animations = [];

var files = $(ME).data('assets');
if (files && files.list) files = files.list;

var loaderfolder = '../botmanager/asset/threejs/three.js-master/examples/js/loaders/';

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

//me.onload = function(cb){
  //me.onloadcb = cb;
  //me.checkIfDone();
//};

//me.checkIfDone = function(){
//  if (me.onloadcb && (!files || files.length == me.models.length)) {
//    me.onloadcb(me);
//  }
//};

me.loadAsset = function(mdb, mfi, type, cb){
  var url = '../botmanager/asset/'+mdb+'/'+mfi;
  var loader = null;
  if (type == 'gltf') {
    if (THREE.GLTFLoader) loader = new THREE.GLTFLoader();
    else $.getScript(loaderfolder +'GLTFLoader.js', function() { me.loadAsset(mdb, mfi, type, cb); });
  }
  else if (type == 'dae') {
    if (THREE.ColladaLoader) loader = new THREE.ColladaLoader();
    else $.getScript(loaderfolder +'ColladaLoader.js', function() { me.loadAsset(mdb, mfi, type, cb); });
  }
  else if (type == 'stl') {
    if (THREE.STLLoader) loader = new THREE.STLLoader();
    else $.getScript(loaderfolder +'STLLoader.js', function() { me.loadAsset(mdb, mfi, type, cb); });
  }
  else if (type == 'obj') {
    if (THREE.MTLLoader){
      var mtlLoader = new THREE.MTLLoader();
      var url2 = url.substring(0,url.length-3)+'mtl';
      mtlLoader.load( url2, function( materials ) {
        materials.preload();
        if (THREE.OBJLoader){
          var loader = new THREE.OBJLoader();
          loader.setMaterials( materials );
          loader.load(
            url,
            function(o){
              addMesh(o, cb);
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded')
            },
            (error) => {
                console.log(error);
            }
          );   
        }
        else $.getScript(loaderfolder +'OBJLoader.js', function() { me.loadAsset(mdb, mfi, type, cb); });
      });
    }
    else $.getScript(loaderfolder +'MTLLoader.js', function() { me.loadAsset(mdb, mfi, type, cb); });
  }

  if (loader){
    loader.load(
      url, 
      function (o) {
        if (type == 'gltf') addMesh(o.scene, cb);
        else if (type == 'dae') addMesh(o.scene, cb);
        else if (type == 'stl') {
          //debugger;
          //if (ME.DATA.pos) o.position.copy(ME.DATA.pos);
          //if (ME.DATA.rot) o.rotation.copy(ME.DATA.rot);
          //if (ME.DATA.scale) o.scale.copy(ME.DATA.scale);
          var c = ME.DATA.color ? ME.DATA.color : "blue";
          var d = {'color': c,
              roughness: 0.5,
              metalness: 0.5,
              flatShading : true 
          };
          material = new THREE.MeshStandardMaterial(d);
          addMesh(new THREE.Mesh(o, material), cb);
        }
      },
      (xhr) => {
          console.log((xhr.loaded / xhr.total * 100) + '% loaded')
      },
      (error) => {
          console.log(error);
      }
    );
  }
};

me.ready = function(){
  if (datGUI) {
    var mname = ME.DATA.name ? ME.DATA.name + " ("+me.modelid+")" : me.modelid;
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

  if (files){
    var l = files.slice();

    function popNext(){
      if (l.length>0){
        var fi = l.shift();
        var ci = fi.indexOf(':');
        var mdb = ci == -1 ? db : fi.substring(0, ci);
        var mfi = ci == -1 ? fi : fi.substring(ci+1);
        var type = mfi.substring(mfi.lastIndexOf('.')+1).toLowerCase();
        me.loadAsset(mdb, mfi, type, popNext);
      }
      else if (ME.DATA.cb) ME.DATA.cb(me);
    }
    popNext();
  }
  else if (ME.DATA.cb) ME.DATA.cb(me);
};

function addMesh(mesh, cb){
  me.models.push(mesh);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  if (group) {
    group.add(mesh);
    //if (group.api)
      //group.api.model.models.push(mesh);
  }
  else scene.add(mesh);
  //helpset[i] = new THREE.SkeletonHelper(set[i]); // FIXME - is this used anywhere?

  var cfolder = me.cfolder;
  mesh.traverse(function(a){
    if (a instanceof THREE.SkinnedMesh){
      a.frustumCulled = false;
      for (var j in a.skeleton.bones){
        var child = a.skeleton.bones[j];
        if (typeof rig[child.name+'_x'] == 'undefined'){
          var n = child.name;

          rig[n+'_x'] = child.rotation.x;
          rig[n+'_y'] = child.rotation.y;
          rig[n+'_z'] = child.rotation.z;

          if (datGUI){
            cfolder.add(rig, n+'_x',-3.14, 3.14);
            cfolder.add(rig, n+'_y',-3.14, 3.14);
            cfolder.add(rig, n+'_z',-3.14, 3.14);
          }
        }
      }
    }
  });
  if (cb) cb(mesh);
  //else me.checkIfDone();
}

me.setPose = function(pose, millis, cb){
  var now = new Date().getTime();
  me.currentPose = {
    "pose": pose,
    "start": now,
    "millis": millis,
    "drig": {},
    "nrig": {},
    "cb": cb
  };
  var nrig = me.currentPose.nrig = pose;
  var drig = me.currentPose.drig = {};
  for (var i in nrig) if (me.rig[i] != nrig[i]) drig[i] = Number(me.rig[i]);
  //if (millis == 0) render();
}

function render() { 
  var now = new Date().getTime();
  for (var i in animations) animations[i](me, now);
  
  if (me.currentPose ){
    var p = Math.min(1, (now - me.currentPose.start)/me.currentPose.millis);
    for (var i in me.currentPose.drig){
      me.rig[i] = me.currentPose.drig[i] + ((me.currentPose.nrig[i] - me.currentPose.drig[i])*p);
    }
    if (p == 1){
      if (me.currentPose.cb) setTimeout(me.currentPose.cb,0);
      me.currentPose = null;
    }
  }

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
      
      child.traverse(function(a){
        if (a instanceof THREE.SkinnedMesh){
          for (var j in a.skeleton.bones){
            var b = a.skeleton.bones[j];
            b.rotation.x = rig[b.name+'_x'];
            b.rotation.y = rig[b.name+'_y'];
            b.rotation.z = rig[b.name+'_z'];
          }
        }
      });
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
