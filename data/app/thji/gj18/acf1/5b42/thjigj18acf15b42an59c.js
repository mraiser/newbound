var me = this; 
var ME = $('#'+me.UUID)[0];

me.animate = function(model){
  me.data = ME.DATA;
  me.model = model;
  me.rebuild();
};

me.setColor = function(r, g, b){
  var c = me.mesh.material.color;
  c.r = r;
  c.g = g;
  c.b = b;
}

me.rebuild = function(){
  var model = me.model;
  
  if (me.mesh){
    var mesh = me.mesh;
    model.models.splice(model.models.indexOf(mesh),1);
    if (model.group) model.group.remove(mesh);
    else model.scene.remove(mesh);
  }
  
  var color = ME.DATA.color ? ME.DATA.color : 0x83bc00;
  
  ME.DATA.color = color;

  var geometry = null;
  var d = {'color': color,
    roughness: 0.5,
    metalness: 0.5,
    flatShading : true 
  };

  if (typeof ME.DATA.opacity != 'undefined'){
    d.transparent = true;
    d.opacity = ME.DATA.opacity;
  }

  if (ME.DATA.shape == 'sphere'){
    var radius = ME.DATA.radius ? ME.DATA.radius : 1;
    var widthSegments = ME.DATA.widthSegments ? ME.DATA.widthSegments : 32;
    var heightSegments = ME.DATA.heightSegments ? ME.DATA.heightSegments : 32;
    geometry = new THREE.SphereGeometry( radius, widthSegments, heightSegments );
  }
  else if (ME.DATA.shape == 'icosphere'){
    var radius = ME.DATA.radius ? ME.DATA.radius : 1;
    var detail = ME.DATA.detail ? ME.DATA.detail : 1;
    geometry = new THREE.IcosahedronGeometry( radius, detail );
    d.flatShading = true;
  }
  else if (ME.DATA.shape == 'text'){
    var fname = ME.DATA.font ? ME.DATA.font : '../app/asset/peer/helvetiker_regular.typeface.json';
    var text = ME.DATA.text ? ME.DATA.text : ME.DATA.text = 'Text';
    if (!document.body.fonts) document.body.fonts = {};
    var f = document.body.fonts[fname];
    if (!f){
      f = document.body.fonts[fname] = {};
      f.cbs = [];
      var loader = new THREE.FontLoader();
      loader.load( fname, function ( ff ) {
        f.font = ff;
        me.rebuild();
      });
    }
    else if (f.font){
      if (me.mesh){
        var i = me.model.models.indexOf(me.mesh);
        me.model.models.splice(i, 1);
        if (me.model.group) me.model.group.remove(me.mesh);
        else me.model.scene.remove(me.mesh);
      }
      geometry = new THREE.TextGeometry( text, {
          font: f.font,
          size: 80,
          height: 5,
          curveSegments: 12,
          bevelEnabled: false,
          bevelThickness: 10,
          bevelSize: 8,
          bevelSegments: 5
      } );
      me.getText = function(){ return ME.DATA.text; }
      me.setText = function(val){
        ME.DATA.text = val;
        me.rebuild();
      };
      while (f.cbs[0]) f.cbs.shift(0)();
    }
    else f.cbs.push(me.rebuild);
  }
  else if (ME.DATA.shape == 'stl' || ME.DATA.shape == 'obj' || ME.DATA.shape == 'dae' || ME.DATA.shape == 'gltf'){
    if (ME.DATA.filename){
      var fi = ME.DATA.filename;
      var ci = fi.indexOf(':');
      var mdb = ci == -1 ? db : fi.substring(0, ci);
      var mfi = ci == -1 ? fi : fi.substring(ci+1);
      var type = mfi.substring(mfi.lastIndexOf('.')+1).toLowerCase();
      me.model.loadAsset(mdb, mfi, type, function(mesh){
        //model.models.push(mesh);
        me.mesh = mesh;
      });
    }
  }
  else {
    var x = ME.DATA.x ? ME.DATA.x : 1;
    var y = ME.DATA.y ? ME.DATA.y : 1;
    var z = ME.DATA.z ? ME.DATA.z : 1;
    geometry = new THREE.BoxGeometry( x, y, z );
  }
  
  if (geometry){
    material = new THREE.MeshStandardMaterial( d );
    var mesh = me.mesh = new THREE.Mesh( geometry, material );
    model.add(mesh);
  }
  
  if (ME.DATA.pos) {
    model.position.x = ME.DATA.pos.x;
    model.position.y = ME.DATA.pos.y;
    model.position.z = ME.DATA.pos.z;
  }
  
  if (ME.DATA.rot) {
    console.log("ROT");
    model.rotation.x = ME.DATA.rot.x;
    model.rotation.y = ME.DATA.rot.y;
    model.rotation.z = ME.DATA.rot.z;
  }
  
  if (ME.DATA.scale) {
    model.scale.x = ME.DATA.scale.x;
    model.scale.y = ME.DATA.scale.y;
    model.scale.z = ME.DATA.scale.z;
  }
};