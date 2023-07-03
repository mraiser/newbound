var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  document.body.api.ui.initNavbar(ME);
  me.children= [];
  me.state = 'cltab1';
  me.data = ME.DATA;
  if (!me.data) me.data = {};
  if (!me.data.three) me.data.three = { "controls": [] };
  if (!me.data.three.assets) me.data.three.assets = [];
  
  $(ME).find('.navbar-tab').click(function(){
    me.state = $(this).data("id");
  });
  
  buildViewer(buildControlList);
};

me.activate = function(){
  setTimeout(function(){
    $(ME).find('.'+me.state+'-tab').click();
  }, 10);
};

me.deactivate = function(){
};

$(ME).find('.add3dctlbutton').click(function(){
  var sels = $(ME).find('.add3dctlselect').find('select');
  var lib = $(sels[0]).val();
  var ctl = $(sels[1]).val();
  debugger;
});

function buildControlList(){
  var newhtml = '<table class="cltabtable" cellpadding="0" cellspacing="0" border="0">';
  for (var i in me.data.three.controls) {
    var ctl = me.data.three.controls[i];
    newhtml += 
      '<tr class="clickmerow"><td class="clickmecell">'
      +ctl.name
      +'<div class="ctllisttype">'
      +ctl.db
      +':'
      +ctl.id
      +'</td><td class="clickmecell" style="text-align:right;"><img src="../app/asset/app/delete_icon-white.png" class="roundbutton-small"></td>'
      +'</tr><tr><td colspan="2"></div><div class="subctl" data-id="'
      +ctl.uuid
      +'"></div></td></tr>';
    
    var el = $('<div id="'+ctl.uuid+'"/>');
    $(ME).append(el);
    me.add(el[0], ctl.db, ctl.id, ctl, function(model){});
  }
  newhtml += '</table>';
  $(ME).find('.3dctllist').html(newhtml).find('.clickmerow').click(function(x,y){
    var subdiv = $(this).next().find('.subctl');
    var uuid = subdiv.data('id');
    var el = $(ME).find('#'+uuid)[0];
    var data = el.DATA;
    var newhtml = '';
    //newhtml += '<input type="text" class="edit3dctl-name" data-key="name" style="width:60px;" value="'+data.name+'">Name';
    newhtml += '<div class="edit3dctl-default"></div>';
    newhtml += '<div class="edit3dctl-editor"></div>';
    subdiv.html(newhtml);
    
    var d = {
      data: data
    };
    
    installControl(subdiv.find('.edit3dctl-default')[0], 'app', 'form', function(api){
      if (el.api.edit) {
        el.api.edit(subdiv.find('.edit3dctl-editor')[0]);
      }
    }, d);
  });
}

function buildViewer(cb){
  $.getScript( '../app/asset/peer/three.min.js', function() { 
    $.getScript( '../app/asset/peer/GLTFLoader.js', function() { 
      $.getScript( '../app/asset/peer/FontLoader.js', function() { 
        $.getScript( '../app/asset/peer/TextGeometry.js', function() { 
          $.getScript( '../app/asset/peer/OrbitControls.js', function() { 
            var url = '../app/asset/peer/helvetiker_regular.typeface.json';
            var loader = new THREE.FontLoader();
            loader.load( url, function ( f ) {
              document.body.font = f;

              var el = $(ME).find('.viewer');
              var scene = me.scene = new THREE.Scene();
              var camera = me.camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
              var renderer = me.renderer = new THREE.WebGLRenderer({ alpha: true });
              
              var w = window.innerWidth;
              var h = window.innerHeight - 96;
              renderer.setSize(w, h);
              renderer.setClearColor( 0x000000, 0);
              el.append( renderer.domElement );
              
              var controls = new THREE.OrbitControls( camera, renderer.domElement );
              controls.addEventListener( 'change', me.render );
              
              hemi = new THREE.HemisphereLight( 0x888888, 0x888888 );
              scene.add(hemi);

              var spotLight = me. spotLight = new THREE.SpotLight(0xffffff);
              spotLight.castShadow = true;
              spotLight.position.set (20, 35, 40);
              scene.add(spotLight);
              scene.add( spotLight.target );

              camera.position.z = 5;
              camera.lookAt(scene.position);
              
              if (cb) cb();
              
              $(renderer.domElement).click(function(event){
                var model = findClick(event);
                if (model && model.click) return model.click(event);
              });

              me.animate();
            });
          });
        });
      });
    });
  });
}

me.animate = function () {
  requestAnimationFrame(me.animate);
  me.render();
};

me.add = function(el, lib, ctl, data, cb, parent){
  installControl(el, lib, ctl, function(api){
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
    if (meta.three) {
      var three = meta.three;
      if (three.controls){
        for (var i in three.controls){
          var ctl = three.controls[i];
          var el2 = $('<div id="'+ctl.uuid+'"/>');
          $(el).append(el2);
          me.add(el2[0], ctl.db, ctl.id, ctl, function(model){}, api);
        }
      }
    }
    
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

function findClick(event){
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
}
