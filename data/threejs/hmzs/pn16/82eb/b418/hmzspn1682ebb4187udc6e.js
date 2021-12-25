var me = this;
var ME = $('#'+me.UUID)[0];

me.data = ME.DATA;

me.animate = function(model){
  me.model = model;
  me.rebuild();
};

me.setColor = function(r, g, b){
  var c = me.model.models[0].material.color;
  c.r = r;
  c.g = g;
  c.b = b;
}

// FIXME - remove support for assets
me.rebuild = function(){
  var model = me.model;
  
  if (me.mesh){
    var mesh = me.mesh;
    model.models.splice(model.models.indexOf(mesh),1);
    if (model.group) model.group.remove(mesh);
    else model.scene.remove(mesh);
  }
  
  var color = ME.DATA.color ? ME.DATA.color : 0xffff00;
  
  ME.DATA.color = color;

  var geometry = null;
  var d = {'color': color,
      roughness: 0.5,
      metalness: 0.5,
//      shininess: 150,
//      specular: 0xffffff,
      flatShading : true 
  };
  //if (ME.DATA.flatShading) d.flatShading = true;
  
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
    var fname = ME.DATA.font ? ME.DATA.font : '../peerbot/helvetiker_regular.typeface.json';
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

    model.models.push(mesh);
    if (model.group) model.group.add(mesh);
    else model.scene.add(mesh);
  }
}

me.render = function(model){
  for (var i in me.animations) me.animations[i](me, now);
  for (var i in model.models){
    var model = model.models[i];
    var rig = me.model.rig;
    model.traverse(function(a){
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
};

me.edit = function(div, cb){
  var d = {
    "list":["cube","sphere", "icosphere", "text", "stl", "obj", "dae", "gltf"],
    "label":"Shape",
    "value":ME.DATA.shape,
    "cb":function(val){
      ME.DATA.shape = val;
      var i = me.model.models.indexOf(me.mesh);
      me.model.models.splice(i, 1);
      if (me.model.group) me.model.group.remove(me.mesh);
      else me.model.scene.remove(me.mesh);
      me.rebuild();
      $(div).find('.shapefilename').css('display', ME.DATA.shape == 'stl' || ME.DATA.shape == 'obj' || ME.DATA.shape == 'dae' || ME.DATA.shape == 'gltf' ? 'block' : 'none');

      if (cb) cb(ME.DATA);
    }
  };
  
  var el = $('<div/>');
  $(div).append(el);
  installControl(el[0], "metabot", "select", function(val){}, d);

  el = $('<div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label is-dirty"><input type="color" id="html5colorpicker" value="'+ME.DATA.color+'" style="width:60px;"><label class="mdl-textfield__label" for="edit3dctlpos">Color</label></div>');
  el.find('input').change(function(e){
    ME.DATA.color = $(this).val();
    me.rebuild();
    if (cb) cb(ME.DATA);
  });
  $(div).append(el);
  
  el = $('<div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label is-dirty" style="display:block;"><input type="text" id="shapeopacity" value="'+(typeof ME.DATA.opacity == 'undefined' ? '' : ME.DATA.opacity)+'" style="width:60px;"><label class="mdl-textfield__label" for="shapeopacity">Opacity (blank/0 to 1)</label></div>');
  el.find('input').change(function(e){
    var val = $(this).val();
    ME.DATA.opacity = Number(val);
    if (val != (''+ME.DATA.opacity)) delete ME.DATA.opacity;
    me.rebuild();
    if (cb) cb(ME.DATA);
  });
  $(div).append(el);
  
  el = $('<div class="shapefilename mdl-textfield mdl-js-textfield mdl-textfield--floating-label is-dirty" style="display:block;"><input type="text" id="filename" value="'+(typeof ME.DATA.filename == 'undefined' ? '' : ME.DATA.filename)+'" style="width:60px;"><label class="mdl-textfield__label" for="filename">Asset</label></div>');
  el.find('input').change(function(e){
    var val = $(this).val();
    ME.DATA.filename = val;
    me.rebuild();
    if (cb) cb(ME.DATA);
  });
  $(div).append(el);
  if (ME.DATA.shape != 'stl') el.css('display', 'none');
  $(div).find('.shapefilename').css('display', ME.DATA.shape == 'stl' || ME.DATA.shape == 'obj' || ME.DATA.shape == 'dae' || ME.DATA.shape == 'gltf' ? 'block' : 'none');
};
