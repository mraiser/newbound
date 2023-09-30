var me = this; 
var ME = $('#'+me.UUID)[0];

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
              var camera = me.camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
              var renderer = me.renderer = new THREE.WebGLRenderer({ alpha: true });
              
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
              
              var render = function(){
                for (var i in me.children){
                  var kid = me.children[i];
                  if (kid.render) kid.render();
                }
                me.renderer.render(me.scene, me.camera);
              };

              var animate = function() {
                requestAnimationFrame(animate);
                render();
              };
              animate();
            });
          });
        });
      });
    });
  });
};

me.addControl = function(el, lib, id, cb, data, parent){
  console.log("ADD CONTROL "+lib+":"+id);
  
  installControl(el, lib, id, function(api){
    var group = new THREE.Group();
    group.api = api;
    api.model = group;
    api.viewer = me;
    if (!api.children) api.children = [];
    
    if (parent) {
      parent.model.add(group);
      parent.children.push(api);
      api.owner = parent;
    }
    else {
      me.scene.add(group);
      me.children.push(api);
      api.owner = me;
    }
    
    var meta = $(el)[0].meta;
    if (meta && meta.three) {
      var three = meta.three;
      if (three.controls){
        for (var i in three.controls){
          var ctl = three.controls[i];
          var el2 = $('<div id="'+ctl.uuid+'"/>');
          $(el).append(el2);
          me.addControl(el2[0], ctl.lib, ctl.id, function(model){}, ctl, api);
        }
      }
    }
    
    if (api.animate) api.animate(group);
    if (cb) cb(api);
//  }, data);
  }, data);
};

me.findClick = function(event){
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
      while (!o.click && o.owner) o = o.owner;
      if (o.click) return o;
    }
  }
  return null;
};





