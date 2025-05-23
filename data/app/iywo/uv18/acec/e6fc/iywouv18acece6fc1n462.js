var me = this; 
var ME = $('#'+me.UUID)[0];

var done = false;
var callbacks = [];
me.waitReady = function(cb){
  callbacks.push(cb);
  checkIfDone();
};

function checkIfDone(){
  if (done) {
    while (callbacks.length>0) callbacks.shift()(me);
  }
}

me.ready = function(){
  me.children = [];
  $.getScript( '../app/asset/app/threejs/three.min.js', function() { 
    $.getScript( '../app/asset/app/threejs/GLTFLoader.js', function() { 
      $.getScript( '../app/asset/app/threejs/FontLoader.js', function() { 
        $.getScript( '../app/asset/app/threejs/TextGeometry.js', function() { 
          $.getScript( '../app/asset/app/threejs/OrbitControls.js', function() { 
            var url = '../app/asset/app/threejs/helvetiker_regular.typeface.json';
            var loader = new THREE.FontLoader();
            loader.load( url, function ( f ) {
              document.body.font = f;

              var el = $(ME).find('.matrixviewer');
              var scene = me.scene = new THREE.Scene();
              scene.viewer = me;
              var camera = me.scene.camera = me.camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
              var renderer = me.scene.renderer = me.renderer = new THREE.WebGLRenderer({ alpha: true });
              
              var w = window.innerWidth;
              var h = window.innerHeight - 96;
              renderer.setSize(w, h);
              renderer.setClearColor( 0x000000, 0);
              el.append( renderer.domElement );
              
              if (ME.DATA.orbit) {
                var controls = new THREE.OrbitControls( camera, renderer.domElement );
              }
              
              hemi = new THREE.HemisphereLight( 0x888888, 0x888888 );
              scene.add(hemi);

              var spotLight = me. spotLight = new THREE.SpotLight(0xffffff);
              spotLight.castShadow = true;
              spotLight.position.set (20, 35, 40);
              scene.add(spotLight);
              scene.add( spotLight.target );

              camera.position.z = 5;
              camera.lookAt(scene.position);
              
              if (ME.DATA.ready) ME.DATA.ready(me);
              
              $(renderer.domElement).click(function(event){
                var model = me.findClick(event);
                if (model && model.click) return model.click(event);
              });
              
              $(renderer.domElement).dblclick(function(event){
                var model = me.findEvent(event, "dblclick");
                if (model && model.dblclick) return model.dblclick(event);
              });
              
              var renderKids = function(who){
                for (var i in who.children){
                  var kid = who.children[i];
                  if (kid.render) kid.render(kid.model);
                  if (kid.children) renderKids(kid);
                  /*
                  if (kid.rig) {
                    if (typeof kid.rig.pos_x != 'undefined') kid.position.x = kid.rig.pos_x;
                    if (typeof kid.rig.pos_y != 'undefined') kid.position.y = kid.rig.pos_y;
                    if (typeof kid.rig.pos_z != 'undefined') kid.position.z = kid.rig.pos_z;
                    if (typeof kid.rig.rot_x != 'undefined') kid.rotation.x = kid.rig.rot_x;
                    if (typeof kid.rig.rot_y != 'undefined') kid.rotation.y = kid.rig.rot_y;
                    if (typeof kid.rig.rot_z != 'undefined') kid.rotation.z = kid.rig.rot_z;
                    if (typeof kid.rig.scale_x != 'undefined') kid.scale.x = kid.rig.scale_x;
                    if (typeof kid.rig.scale_y != 'undefined') kid.scale.y = kid.rig.scale_y;
                    if (typeof kid.rig.scale_z != 'undefined') kid.scale.z = kid.rig.scale_z;
                  }
                  */
                }
              };
              
              var render = function(){
                renderKids(me);
                me.renderer.render(me.scene, me.camera);
              };

              var animate = function() {
                requestAnimationFrame(animate);
                render();
              };
              animate();
              
              done = true;
              checkIfDone();
            });
          });
        });
      });
    });
  });
};

function addFunction(obj, name, params, body){
  function construct(args) {
    function F() { return Function.apply(obj, args); }
    F.prototype = Function.prototype;
    return new F();
  }
  var args = params.slice();
  args.push(body);
  var f = construct(args);
  obj[name] = function(){
    return f.apply(obj, arguments);
  }
}

me.add = function(el, lib, id, cb, data, parent){
  console.log("ADD CONTROL "+lib+":"+id);
  
  if (typeof lib == 'undefined')
    debugger;
  
  installControl(el, lib, id, function(api){
    api.data = data;
    
    var kidcount = 0;
    function checkTheKids(){
      if (kidcount == 0) {
        console.log("I AM DONE");
        if (api.animate) 
          api.animate(group);
        if (cb) cb(api.model);
      }
    }
    
    var group = new THREE.Group();
    group.api = api;
    group.rig = {};
    group.scene = me.scene;
    api.model = group;
    api.viewer = me;
    
    if (!api.children) api.children = [];
    if (!api.rig) api.rig = group.rig;
    
    if (parent) {
      parent.model.add(group);
    }
    else {
      me.scene.add(group);
      parent = me;
    }
    
    api.owner = parent;
    parent.children.push(group);
        
    var meta = $(el)[0].meta;
    if (meta && meta.three) {
      var three = meta.three;
      if (three.behaviors){
        for (var i in three.behaviors) {
          var b = three.behaviors[i];
          var args = [];
          for (j in b.params) args.push(b.params[j].name);
          if (b.lang == 'flow') me.interpreter.addFunction(api, b.name, b);
          else addFunction(api, b.name, args, b.body);
        }
      }
      if (three.controls){
        for (var i in three.controls){
          var ctl = three.controls[i];
          if (!ctl.lib) { ctl.lib = ctl.db; }
          var el2 = $('<div id="'+ctl.uuid+'"/>');
          $(el).append(el2);
          kidcount++;
          me.add(el2[0], ctl.lib, ctl.id, function(model){
            kidcount--;
            checkTheKids();
          }, ctl, api);
        }
      }
    }
    
    checkTheKids();
  }, data);
};

me.findClick = function(event){
  return me.findEvent(event, "click");
};

me.findEvent = function(event, typ){
  event.three = {};
  var clientX = event.clientX - $(ME).offset().left;
  var clientY = event.clientY - $(ME).offset().top;
  var vector = new THREE.Vector3(
    ( clientX / $(ME).width() ) * 2 - 1,
    - ( clientY / $(ME).height() ) * 2 + 1,
    0.5
  );
  vector.unproject(me.camera);

  var ray = new THREE.Raycaster( me.camera.position, vector.sub( me.camera.position ).normalize() );
  event.three.ray = ray.ray;

  var l1 = []
  for (var i in me.children) l1.push(me.children[i].model);

  var intersects = ray.intersectObjects( l1, true );
  if ( intersects.length > 0 ) {
    event.three.intersect = intersects[0];
    var o = event.three.intersect.object;
    while (!o.api && o.parent) o = o.parent;
    if (o.api) {
      o = o.api;
      while (!o[typ] && o.owner) o = o.owner;
      if (o[typ]) return o;
    }
  }
  return null;
};





