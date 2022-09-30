var me = this;
var ME = $('#'+me.UUID)[0];

me.children = [];

me.ready = function(){
  $.getScript( '../app/asset/peer/three.min.js', function() { 
    $.getScript( '../app/asset/peer/GLTFLoader.js', function() { 
      $.getScript( '../app/asset/peer/FontLoader.js', function() { 
        $.getScript( '../app/asset/peer/TextGeometry.js', function() { 
          var url = '../app/asset/peer/helvetiker_regular.typeface.json';
          var loader = new THREE.FontLoader();
          loader.load( url, function ( f ) {
            document.body.font = f;
            
            var scene = me.scene = new THREE.Scene();
            var camera = me.camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
            var renderer = me.renderer = new THREE.WebGLRenderer();
            renderer.setSize( window.innerWidth, window.innerHeight );
            $(ME).find('.viewer').append( renderer.domElement );

            hemi = new THREE.HemisphereLight( 0x888888, 0x888888 );
            scene.add(hemi);

            spotLight = new THREE.SpotLight(0xffffff);
            spotLight.castShadow = true;
            spotLight.position.set (20, 35, 40);
            scene.add(spotLight);

            camera.position.z = 5;
            camera.lookAt(scene.position);
            
            send_peers(function(result){
              for (var i in result.data) {
                var p = result.data[i];
                var el = $('<div/>');
                $(ME).append(el);
                me.add(el[0], 'peer', 'peer_model', p, function(model) {});
              }
            });
            
            var animate = function () {
              requestAnimationFrame( animate );
              for (var i in me.children){
                var kid = me.children[i];
                if (kid.render) kid.render();
              }
              renderer.render( scene, camera );
            };
            animate();
          });
        });
      });
    });
  });
};

me.add = function(el, lib, ctl, data, cb){
  installControl(el, lib, ctl, function(api){
    var group = new THREE.Group();
    me.scene.add(group);
    api.model = group;
    api.viewer = me;
    me.children.push(api);
    if (api.animate) api.animate(group);
    if (cb) cb(api);
  }, data);
};

$(window).on("resize", function(e){
  var w = $(ME).width();
  var h = $(ME).height();
  $(ME).find("canvas").width(w).height(h);
  me.camera.aspect = w / h;
  me.camera.updateProjectionMatrix();
  me.renderer.setSize(w, h);
});