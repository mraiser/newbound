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
    $(ME).find('.x3dctl-detail').css('display', 'none');
    $(ME).find('.x3dbehavior-editor').css('display', 'none');
  });
  
  buildViewer(buildControlList);
  buildBehaviors();
  
  $(ME).find('.baseparams').find('input').change(document.body.dirty);
  $(ME).find('.add3dbehaviorbutton').click(function(){
    var nuname = prompt("Behavior Name");
    var d = {
      id: guid(),
      name: nuname,
      body: "return 'ok';",
      params: []
    };
    if (!me.data.three.behaviors) me.data.three.behaviors = [];
    me.data.three.behaviors.push(d);
    buildBehaviors();
  });
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
  var name = $(sels[1]).find('option:selected').text();
  
  var d = {
    db: lib,
    id: ctl,
    name: name
  };
  
  me.data.three.controls.push(d);
  buildControlList();
  document.body.dirty();
});

function buildBehaviors(){
  var el = $(ME).find('.behaviorlist');
  var d = {
    list: me.data.three.behaviors,
    allowdelete: true,
    on_delete: function(){
      document.body.dirty();
    },
    click_edit:function(ctl, index){
      var el = $(ME).find('.x3dbehavior-editor');
      var bwrap = el.find('.bwrap');
      var ta = $("<textarea class='x3dbehavior-src-js'></textarea>");
      bwrap.empty();
      bwrap.append(ta);
      ta.val(ctl.body);
      el.css('display','inline-block');
      
      var row = $($('.behaviorlist').find('li')[index]).find('span').find('span');
      
      var rebuildParams = function(){
        var newhtml = "function <input class='abn' type='text' value='"+ctl.name+"'>&nbsp;(";
        for (var i in ctl.params){
          var p = ctl.params[i];
          console.log(p);
          if (i>0) newhtml += ", ";
          newhtml += "<button class='abp abdel' data-index='"+i+"'>x</button>";
          newhtml += p.name;
        }
        newhtml += "<button class='abp abplus'>+</button>";
        newhtml += "){";
        $(ME).find('.x3db-name').html(newhtml);
        
        var abn = el.find('.abn');
        var plus = el.find('.abplus');
        var del = el.find('.abdel');
        plus.click(function(){ 
          var q = prompt("Parameter Name");
          var d = {
            name: q,
            type: "object"
          };
          ctl.params.push(d);
          rebuildParams();
        });
        del.click(function(){ 
          var q = $(this).data('index');
          ctl.params.splice(q,1);
          rebuildParams();
        });
        abn.change(ub).keyup(function(){
          ctl.name = abn.val();
          row.text(ctl.name);
        });
      };
      rebuildParams();
      
      var c = ta[0];
      var conf = {
        mode : 'javascript',
        theme: 'abcdef',
        lineWrapping: true,
        autofocus : false,
        viewportMargin: Infinity
      };
      c.cm = CodeMirror.fromTextArea(c, conf);
      
      var ub = function(){
        document.body.dirty();
        ctl.body = c.cm.getValue();
      };
      
      el.find('textarea').change(ub).keyup(ub);
      
      me.current_behavior = [ ctl, index, row ];
    }
  };
  installControl(el[0], 'app', 'list', function(api){
    
  }, d);
}

function build3D(){
  for (var i in me.children) {
    var kid = me.children[i];
    me.scene.remove(kid.model);
    $('#'+kid.UUID).remove();
  }
  me.children = [];
  
  for (var i in me.data.three.controls) {
    var ctl = me.data.three.controls[i];
    //if (!ctl.uuid) ctl.uuid = guid();
    //var el = $('<div id="'+ctl.uuid+'"/>');
    //$(ME).append(el);
    //me.add(el[0], ctl.db, ctl.id, ctl, function(api){
    me.load(ctl, function(api){
      var model = api.model;
      if (ctl.pos){
        model.position.x = ctl.pos.x;
        model.position.y = ctl.pos.y;
        model.position.z = ctl.pos.z;
      }
      else ctl.pos = { x:0,y:0,z:0 };
      if (ctl.rot){
        model.rotation.x = ctl.rot.x;
        model.rotation.y = ctl.rot.y;
        model.rotation.z = ctl.rot.z;
      }
      else ctl.rot = { x:0,y:0,z:0 };
      if (ctl.scale){
        model.scale.x = ctl.scale.x;
        model.scale.y = ctl.scale.y;
        model.scale.z = ctl.scale.z;
      }
      else ctl.scale = { x:1,y:1,z:1 };
    });
  }
}

function buildControlList(){
  var el = $(ME).find('.3dctllist');
  var d = {
    list: me.data.three.controls,
    allowdelete: true,
    on_delete: function(){
      build3D();
      document.body.dirty();
    },
    click_edit:function(ctl, index){
      var div = $('#'+ctl.uuid);
      var api = div[0].api;
      var meta = div[0].meta;
      
      var puts = $(ME).find('.baseparams').find('input');
      $(puts[0]).val(ctl.name);
      
      var pos = api.model.position;
      $(puts[1]).val(pos.x);
      $(puts[2]).val(pos.y);
      $(puts[3]).val(pos.z);
      var rot = api.model.rotation;
      $(puts[4]).val(rot.x);
      $(puts[5]).val(rot.y);
      $(puts[6]).val(rot.z);
      var scale = api.model.scale;
      $(puts[7]).val(scale.x);
      $(puts[8]).val(scale.y);
      $(puts[9]).val(scale.z);
      
      $(ME).find('.x3dctl-detail').css('display', 'inline-block');
      $(ME).find('.x3dctl').css('display', 'none');
      div.css('display', 'inline-block');
      
      var row = $($('.x3dctllist').find('li')[index]).find('span').find('span');
      me.current_kid = [ ctl, api, meta, index, row ];
    }
  };
  installControl(el[0], 'app', 'list', function(api){
    build3D();
  }, d);
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
              //controls.addEventListener( 'change', me.render );
              
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

me.load = function(ctl, cb, parent){
  if (!ctl.uuid) ctl.uuid = guid();
  var el = $('<div id="'+ctl.uuid+'" class="hideme x3dctl"/>');
  $(ME).find('.x3dctl-editor').append(el);
  var lib = ctl.db;
  var id = ctl.id;
//  me.add(el2[0], ctl.db, ctl.id, ctl, cb, parent);
//};
//
//me.add = function(el, lib, ctl, data, cb, parent){
//  installControl(el, lib, ctl, function(api){
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
          //var el2 = $('<div id="'+ctl.uuid+'"/>');
          //$(el).append(el2);
          //me.add(el2[0], ctl.db, ctl.id, ctl, function(model){}, api);
          me.load(ctl, function(model){}, api);
        }
      }
    }
    
    if (api.animate) api.animate(group);
    if (cb) cb(api);
//  }, data);
  }, ctl);
};

me.render = function(){
  for (var i in me.children){
    var kid = me.children[i];
    if (kid.render) kid.render();
  }
  if (me.current_kid) {
    var ctl = me.current_kid[0];
    var api = me.current_kid[1];
    
    var puts = $(ME).find('.baseparams').find('input');
    ctl.name = $(puts[0]).val();
    me.current_kid[4].text(ctl.name);
    
    var pos = api.model.position;
    pos.x = ctl.pos.x = $(puts[1]).val();
    pos.y = ctl.pos.y = $(puts[2]).val();
    pos.z = ctl.pos.z = $(puts[3]).val();
    var rot = api.model.rotation;
    rot.x = ctl.rot.x = $(puts[4]).val();
    rot.y = ctl.rot.y = $(puts[5]).val();
    rot.z = ctl.rot.z = $(puts[6]).val();
    var scale = api.model.scale;
    scale.x = ctl.scale.x = $(puts[7]).val();
    scale.y = ctl.scale.y = $(puts[8]).val();
    scale.z = ctl.scale.z = $(puts[9]).val();
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
