var me = this;
var ME = $('#'+me.UUID)[0];

me.children = [];

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
};

me.ready = function(){
  subscribe_event("peer", "UPDATE", function(data){
    $(ME).find('#peer_'+data.id)[0].DATA = data;
  });
  
  $.getScript( '../app/asset/peer/three.min.js', function() { 
    $.getScript( '../app/asset/peer/GLTFLoader.js', function() { 
      $.getScript( '../app/asset/peer/FontLoader.js', function() { 
        $.getScript( '../app/asset/peer/TextGeometry.js', function() { 
          $.getScript( '../app/asset/peer/OrbitControls.js', function() { 
            var url = '../app/asset/peer/helvetiker_regular.typeface.json';
            var loader = new THREE.FontLoader();
            loader.load( url, function ( f ) {
              document.body.font = f;

              var scene = me.scene = new THREE.Scene();
              var camera = me.camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
              var renderer = me.renderer = new THREE.WebGLRenderer();
              renderer.setSize( window.innerWidth, window.innerHeight );
              $(ME).find('.viewer').append( renderer.domElement );

              controls = new THREE.OrbitControls( camera, renderer.domElement );
              controls.addEventListener( 'change', me.render );
              
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
                  addPeer(p);
                }
                send_info(function(result){
                  $(ME).find('.localpeername').text(result.data.name);
                  $(ME).find('.localpeerid').text(result.data.uuid);
                  $(ME).find('.localpeerport').text("Port: "+result.data.port);
                });
              });

              me.animate();
            });
          });
        });
      });
    });
  });
};

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

function addPeer(p) {
  var el = $('<div id="peer_'+p.id+'"/>');
  $(ME).append(el);
  me.add(el[0], 'peer', 'peer_model', p, function(api) {
    var num = p.id.hashCode();
    var count = 100000;
    var n = (num/count)*Math.PI*2;
    var s = 0.25;
    var r = 10; //((count*2)/Math.PI)/20;
    var q = 5-(num%11);
    var x = Math.sin(n)*r;
    var y = 0.1/(q?q:1);
    var z = Math.cos(n)*r;
    api.model.position.copy(new THREE.Vector3(x,y,z));
    api.model.scale.copy(new THREE.Vector3(s,s,s));
  });
}

me.add = function(el, lib, ctl, data, cb){
  installControl(el, lib, ctl, function(api){
    var group = new THREE.Group();
    group.api = api;
    me.scene.add(group);
    api.model = group;
    api.viewer = me;
    me.children.push(api);
    if (api.animate) api.animate(group);
    if (cb) cb(api);
  }, data);
};

me.render = function(){
  for (var i in me.children){
    var kid = me.children[i];
    if (kid.render) kid.render();
  }
  me.renderer.render(me.scene, me.camera);
}

me.animate = function () {
  requestAnimationFrame(me.animate);
  me.render();
};

$(window).on("resize", function(e){
  var w = $(ME).width();
  var h = $(ME).height();
  $(ME).find("canvas").width(w).height(h);
  me.camera.aspect = w / h;
  me.camera.updateProjectionMatrix();
  me.renderer.setSize(w, h);
});