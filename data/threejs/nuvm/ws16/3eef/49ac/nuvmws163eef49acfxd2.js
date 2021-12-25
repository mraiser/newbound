var me = this;
var ME = $('#'+me.UUID)[0];

var container, stats, clock, controls;
var camera, scene, renderer, mixer, models, avatar, toload;

var datprefix = $(ME).data('datguipath') ? $(ME).data('datguipath') : '../botmanager/asset/threejs/dat.gui-master/';
var libprefix = $(ME).data('threepath') ? $(ME).data('threepath') : '../botmanager/asset/threejs/three.js-master/';
var libs = [
  'build/three.min.js',
  'examples/js/controls/OrbitControls.js',
  'examples/js/libs/stats.min.js'
//  'examples/js/loaders/GLTFLoader.js',
//  'examples/js/loaders/FBXLoader.js',
//  'examples/js/loaders/STLLoader.js',
//  'examples/js/loaders/ColladaLoader.js',
//  'examples/js/loaders/MTLLoader.js',
//  'examples/js/loaders/OBJLoader.js'
];

var models = me.models = [];
var count = 0;
var done = false;
var mouse = {};
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

me.removeModel = function(model){
  if (model.group && model.group.parent) 
    model.group.parent.remove(model.group);
  me.scene.remove(model);
  
  for (var i in model.models)
    me.removeModel(model.models[i]);
  
  var name = model.UUID;
  var folder = me.datGUI.__folders ? me.datGUI.__folders[name] : null;
  if (folder) {
    folder.close();
    me.datGUI.__ul.removeChild(folder.domElement.parentNode);
    delete me.datGUI.__folders[name];
    me.datGUI.onResize();  
  }  
  var i = me.models.indexOf(model);
  if (i != -1)
    me.models.splice(i,1);
}

me.loadModel = function(el, assets, animations, db, pos, rot, scale, cb){
  // FIXME - Combine with me.add and ControlLoader
  // FIXME respect parentgroup
  $(el).data('datgui', me.datGUI);
  $(el).data('scene', scene);
  if (assets) $(el).data('assets', assets);
  if (animations) $(el).data('animations', animations);
  if (db) $(el).data('db', db);
  if (pos) $(el).data('pos', pos);
  if (rot) $(el).data('rot', rot);
  if (scale) $(el).data('scale', scale);
  
  var group = $(el).data('group');

  var ani1 = animations;
  var ani2 = [];

  function loadModel(){
    installControl(el, "threejs", "controlloader", function(api){
      api.api = group && group.api ? group.api : {};
      models.push(api);

      for (var i in ani2) {
        var a2i = ani2[i];
        if (a2i.animate) a2i.animate(api);
        if (a2i.render) api.animations.push(a2i.render);
      }
      
      if (cb) cb(api);
    }, {});
  }
  
  if (ani1){
    function loadNext(){
      if (ani1.list.length > 0){
        var ani = ani1.list.shift();
        var i = ani.indexOf(':');
        var dbi = i == -1 ? db : ani.substring(0,i);
        ani = i == -1 ? ani : ani.substring(i+1);
        installControl(el, dbi, ani, function(animation){
          ani2.push(animation);
          loadNext();
        }, {});
      }
      else loadModel();
    }
    loadNext();
  }
  else loadModel();
  
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

me.add = function(el, db, id, cb, data, parentgroup){
  // FIXME combine with me.loadModel and ControlLoader
  // FIXME respect parentgroup
  $(el).data('datgui', me.datGUI);
  $(el).data('scene', scene);
  $(el).data('db', db);
  if (!data) data = {};

  var group = new THREE.Group();
//  if (data.pos) group.position.copy(data.pos);
//  if (data.rot) group.rotation.copy(data.rot);
//  if (data.scale) group.scale.copy(data.scale);
  
  if (parentgroup) parentgroup.add(group);
  else scene.add(group);
  $(el).data('group', group);

  installControl(el, db, id, function(api){
    var current = api;
    api.group = group;
    group.api = api;

    var ani1 = $(el).data('animations');
    var ani2 = [];
    var anim = api.animate;
    var rend = api.render;
    
    var meta = $(el)[0].meta;
    var forward = function(){
      meta = $(el)[0].meta;
      if (!meta) setTimeout(forward,100); // FIXME - Is this needed? If so does it actually work?
      else {
      
      
      
      
      
        var three = meta.three;

        function loadModel(){


  /*        
          me.loadModel(el, $(el).data('assets'), $(el).data('animations'), db, data.pos, data.rot, data.scale, function(model){
            model.api = current;
            current.model = model;
            models.push(model);
            loadControls(model);
          });
  */        


          installControl(el, "threejs", "controlloader", function(api){
            api.api = current;
            current.model = api;
            models.push(api);

            if (three) {
              current.poses = three.poses;
              current.motions = three.animations;

              current.setPose = function(posename, millis, cb){
                for (var i in current.children) {
                  var mid = current.children[i].modelid;
                  var pose = getByProperty(current.poses, "name", posename);
                  if (!pose) pose = getByProperty(current.poses, "id", posename);
                  current.children[i].setPose(pose.pose[mid], millis, cb);
                  cb = null;
                }
              }

              current.setMotion = function(motionname, cb){
                var motion = getByProperty(current.motions, "name", motionname);
                if (!motion) motion = getByProperty(current.motions, "id", motionname);
                var l = motion.steps.slice();
                function popNext(){
                  if (l.length>0){
                    var step = l.shift();
                    current.setPose(step.pose, step.millis, popNext);
                  }
                  else if (cb) cb();
                }
                popNext();
              }
            }

            for (var i in ani2) {
              var a2i = ani2[i];
              if (a2i.animate) a2i.animate(api);
              if (a2i.render) api.animations.push(a2i.render);
            }
            loadControls(api);
          }, data);

        }    

        function finish(api){
          if (three && three.behaviors){
            for (var i in three.behaviors) {
              var b = three.behaviors[i];
              var args = [];
              for (j in b.params) args.push(b.params[j].name);
              if (b.lang == 'flow') me.interpreter.addFunction(api.api, b.name, b);
              else addFunction(api.api, b.name, args, b.body);

              anim = api.api.animate;
              rend = api.api.render;
            }
          }
          if (anim) anim(api);
          if (rend) api.animations.push(rend);
          if (cb) cb(api);
        }

        function loadControls(api){ // FIXME - confusing. Variable api is really the model here. Also it is never referenced other than to pass it to loadAssets, which also calls it api.
          if (three){
            if (three.controls){
              var l = three.controls.slice();
              function nextCtl(){
                if (l.length>0){
                  var ctl = Object.assign({}, l.shift());

                  var nuid = guid();
                  if (three.poses){
                    for (var i in three.poses){
                      var p = three.poses[i];
                      p.pose[nuid] = p.pose[ctl.uuid];
                    }
                  }

                  var el2 = $('<div id="'+nuid+'" style="position:absolute;top:0px;"/>');
  //                var el2 = $('<div style="position:absolute;top:0px;"/>');
                  $(ME).append(el2);
                  me.add(el2[0], ctl.db, ctl.id, function(api){
                    api.parent = current;
                    if (!current.children) current.children = [];
                    current.children.push(api);
                    nextCtl();
                  }, ctl, group);
                }
                else loadAssets(api);
              }
              nextCtl();
            }
            else loadAssets(api);
          }
          else loadAssets(api);
        }

        function loadAssets(api){
          if (three){
            if (three.assets){
              var l = three.assets.slice();
              function nextAsset(){
                if (l.length>0){
                  var a = l.shift();

  /*                
                  var ctl = Object.assign({}, a);
                  var el2 = $('<div style="position:absolute;top:0px;"/>');
                  $(ME).append(el2);
                  $(el2).data('datgui', me.datGUI);
                  $(el2).data('scene', scene);
                  $(el2).data('db', db);
                  $(el2).data('group', group);
                  me.loadModel(el2, {"list":[a.db+":"+a.id]}, null, db, a.pos, a.rot, a.scale, function(model){
                    model.parent = current;
                    if (!current.children) current.children = [];
                    current.children.push(model);
                    nextAsset();
                  });
  */                
  //*                
                  var type = a.id.substring(a.id.lastIndexOf('.')+1).toLowerCase();
                  current.model.loadAsset(a.db, a.id, type, function(mesh){
                    if (a.pos) mesh.position.set(Number(a.pos.x),Number(a.pos.y),Number(a.pos.z)); //copy(a.pos);
                    if (a.rot) mesh.rotation.set(Number(a.rot.x),Number(a.rot.y),Number(a.rot.z)); //copy(a.rot);
                    if (a.scale) mesh.scale.set(Number(a.scale.x),Number(a.scale.y),Number(a.scale.z)); //copy(a.scale);
                    if (a.color) mesh.material.color.setHex(Number("0x"+a.color.substring(1)));
                    nextAsset();
                  });
  //*/
                }
                else finish(api);
              }
              nextAsset();
            }
            else finish(api);
          }
          else finish(api);
        }

        if (ani1){
          function loadNext(){
            if (ani1.list.length > 0){
              var ani = ani1.list.shift();
              var i = ani.indexOf(':');
              var dbi = i == -1 ? db : ani.substring(0,i);
              ani = i == -1 ? ani : ani.substring(i+1);
              installControl(el, dbi, ani, function(animation){
                ani2.push(animation);
                loadNext();
              }, data);
            }
            else loadModel();
          }
          loadNext();
        }
        else 
          loadModel();
      }
    }
    forward();
  }, data);
};

me.ready = function(){
  installControl($(ME).find('.interpreter')[0], 'flow', 'interpreter', function(api){
    me.interpreter = api;
    var libindex = 0;
    function loadNext(){
      if (libindex<libs.length) promise = doAfterLoading(promise, libprefix + libs[libindex++], loadNext);
      else  {
        //if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

        toload = $(ME).data('controls');
        if (!toload) toload = [];

        startup();
      }
    }
    var promise = $.when(true);
    promise = doAfterLoading(promise,  datprefix+'build/dat.gui.min.js', loadNext);
  });
};

function loadScript( url, cb ) {
  return $.getScript( url, function() { cb(); });
}

function doAfterLoading(promise, url, cb){
  return promise.then(function () {
    return loadScript( url, cb );
  });
}

function startup(){
  /*global variables*/
  var controls, guiControls, datGUI;
  var stats;
  var spotLight, hemi;
  var loader, model;
  
  
  function init(){
    /*creates empty scene object and renderer*/
    scene = me.scene = new THREE.Scene();
    camera = scene.camera = new THREE.PerspectiveCamera(45, $(ME).width()/$(ME).height(), .1, 500);
    renderer = me.renderer = new THREE.WebGLRenderer({antialias:true, alpha: true});
    
    scene.viewer = me;
    
//    renderer.setClearColor(0x333300);
    renderer.setSize($(ME).width(), $(ME).height());
    renderer.shadowMapEnabled= true;
    renderer.shadowMapSoft = true;
    
    /*add controls*/
    if ($(ME).data('orbitcontrols') == true){
      controls = me.controls = new THREE.OrbitControls( camera, renderer.domElement );
      controls.addEventListener( 'change', render );
    }
    
    camera.position.x = 6;
    camera.position.y = 2;
    camera.position.z = 6;    
    camera.lookAt(scene.position);

    /*datGUI controls object*/
    guiControls = new function(){
      this.rotationX  = 0.0;
      this.rotationY  = 0.0;
      this.rotationZ  = 0.0;
      
      this.lightX = 131;
      this.lightY = 107;
      this.lightZ = 180;
      this.intensity = 1.5;       
      this.distance = 373;
      this.angle = 1.6;
      this.exponent = 38;
      this.shadowCameraNear = 34;
      this.shadowCameraFar = 2635;
      this.shadowCameraFov = 68;
      this.shadowCameraVisible=false;
      this.shadowMapWidth=512;
      this.shadowMapHeight=512;
      this.shadowBias=0.00;
      this.shadowDarkness=0.11;
      
      this.scene = function(){
      };

      function resetMouse(){
        mouse.down = false;
        mouse.model = null;
        mouse.over = null;
        mouse.three = null;
      }
      
      $(ME).mousedown(function(event){
        if (mouse.down) $(ME).mouseup(event);
        
        var model = mouse.model = findClick(event);
        mouse.three = event.three;
        mouse.down = true;
        if (model && model.mousedown) return model.mousedown(event);
      });
      
      $(ME).mouseup(function(event){
        var model = findClick(event);
        var x = null;
        if (mouse.model && mouse.model.drop) x = mouse.model.drop(event, model);
        if (mouse.model && mouse.model.mouseup) x = mouse.model.mouseup(event);
        resetMouse();
        return x;
      });
      
      $(ME).mousemove(function(event){
        var model = findClick(event);
        if (model && model.mousemove) model.mousemove(event);
        
        if (mouse.down && mouse.model && model && model.dragover) {
          if (mouse.over && mouse.over != model && mouse.over.dragoff) mouse.over.dragoff(event);
          mouse.over = model;
          model.dragover(event, mouse.model);
        }
        else if (!model && mouse.over && mouse.over.dragoff) {
          mouse.over.dragoff(event);
          mouse.over = null;
        }
        
        if (mouse.down && mouse.model && mouse.model.drag){

          var camdir = mouse.model.scene.camera.getWorldDirection();
          var campos = mouse.model.scene.camera.position;
          var dir = event.three.ray.direction;
          var origin = mouse.three.intersect.point;
          var a = camdir.x;
          var b = camdir.y;
          var c = camdir.z;
          var t = ((a * origin.x) + (b * origin.y) + (c * origin.z) - (a*campos.x) - (b*campos.y) - (c*campos.z)) / (((a*dir.x) + (b*dir.y) + (c*dir.z)));
          var p = event.three.ray.direction.clone().multiplyScalar(t).add(event.three.ray.origin);

          event.three.drag = p;
          return mouse.model.drag(event);
        }
      });
            
      $(ME).click(function(event){
        var model = findClick(event);
        if (model && model.click) return model.click(event);
      });
      
      $(ME).dblclick(function(event){
        var model = findClick(event);
        if (model && model.dblclick) return model.dblclick(event);
      });
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

      vector.unproject(camera);

      var ray = new THREE.Raycaster( camera.position, vector.sub( camera.position ).normalize() );
      event.three.ray = ray.ray;

      function pushModels(m, l1, l2){
        for (var j in m.models) {
          l1.push(m.models[j]);
          l2.push(m);
        }
      }
      
      var l1 = []
      var l2 = []
      for (var i in me.models) pushModels(me.models[i], l1, l2);
      
      var intersects = ray.intersectObjects( l1, true );

      if ( intersects.length > 0 ) {
        event.three.intersect = intersects[0];
        var i = l1.indexOf(event.three.intersect.object);
        event.three.intersect.api = l2[i];
        return l2[i];
      }
      return null;
    }
      
    //add some nice lighting
    hemi = new THREE.HemisphereLight( 0xffffff, 0xffffff );
    scene.add(hemi);
    //add some fog
    scene.fog = new THREE.Fog( 0xffff90, .01, 500 );

    /*adds spot light with starting parameters*/
    spotLight = new THREE.SpotLight(0xffffff);
    spotLight.castShadow = true;
    spotLight.position.set (20, 35, 40);
    spotLight.intensity = guiControls.intensity;        
    spotLight.distance = guiControls.distance;
    spotLight.angle = guiControls.angle;
    spotLight.exponent = guiControls.exponent;
    spotLight.shadowCameraNear = guiControls.shadowCameraNear;
    spotLight.shadowCameraFar = guiControls.shadowCameraFar;
    spotLight.shadowCameraFov = guiControls.shadowCameraFov;
    spotLight.shadowCameraVisible = guiControls.shadowCameraVisible;
    spotLight.shadowBias = guiControls.shadowBias;
    spotLight.shadowDarkness = guiControls.shadowDarkness;
    scene.add(spotLight);
      
    /*adds controls to scene*/
    if ($(ME).data('showdatgui') == true){
      datGUI = me.datGUI = new dat.GUI();
      datGUI.add(guiControls, "scene");
//      datGUI.close();
    }
    else {
      datGUI = me.datGUI = {}; 
    
      datGUI.addFolder = function(){
        var f = {};
        var f2 = {};
        f.add = f2.name = function(){
          f2.onChange = function(){};
          return f2;
        };
        return f;
      };
    }
    
    $(ME).find(".webGL-container").append(renderer.domElement);
//    stats = new Stats();        
//    stats.domElement.style.position = 'absolute';
//    stats.domElement.style.left = '0px';
//    stats.domElement.style.top = '0px';     
//    $("#webGL-container").append( stats.domElement );
    
    var lfolder = datGUI.addFolder('Lights');
    lfolder.add(guiControls, 'lightX',-60,400); 
    lfolder.add(guiControls, 'lightY',0,400);   
    lfolder.add(guiControls, 'lightZ',-60,400);
    
    lfolder.add(guiControls, 'intensity',0.01, 5).onChange(function(value){
        spotLight.intensity = value;
    });     
    lfolder.add(guiControls, 'distance',0, 1000).onChange(function(value){
        spotLight.distance = value;
    }); 
    lfolder.add(guiControls, 'angle',0.001, 1.570).onChange(function(value){
        spotLight.angle = value;
    });     
    lfolder.add(guiControls, 'exponent',0 ,50 ).onChange(function(value){
        spotLight.exponent = value;
    });
    lfolder.add(guiControls, 'shadowCameraNear',0,100).name("Near").onChange(function(value){       
        spotLight.shadowCamera.near = value;
        spotLight.shadowCamera.updateProjectionMatrix();        
    });
    lfolder.add(guiControls, 'shadowCameraFar',0,5000).name("Far").onChange(function(value){
        spotLight.shadowCamera.far = value;
        spotLight.shadowCamera.updateProjectionMatrix();
    });
    lfolder.add(guiControls, 'shadowCameraFov',1,180).name("Fov").onChange(function(value){
        spotLight.shadowCamera.fov = value;
        spotLight.shadowCamera.updateProjectionMatrix();
    });
    lfolder.add(guiControls, 'shadowCameraVisible').onChange(function(value){
        spotLight.shadowCameraVisible = value;
        spotLight.shadowCamera.updateProjectionMatrix();
    });
    lfolder.add(guiControls, 'shadowBias',0,1).onChange(function(value){
        spotLight.shadowBias = value;
        spotLight.shadowCamera.updateProjectionMatrix();
    });
    lfolder.add(guiControls, 'shadowDarkness',0,1).onChange(function(value){
        spotLight.shadowDarkness = value;
        spotLight.shadowCamera.updateProjectionMatrix();
    });
    
	for (var i in toload) {
      var ctl = toload[i];
      var el = $('<div id="m'+(count++)+'_'+ctl.name+'"/>')[0];
      $(ME).append(el);
      me.add(el, ctl.db, ctl.name);
    }
    
    animate();
      
    done = true;
    checkIfDone();
  }
      
  function render() { 
    spotLight.position.x = guiControls.lightX;
    spotLight.position.y = guiControls.lightY;
    spotLight.position.z = guiControls.lightZ;
    
    for (var i in models) models[i].render();
    
    scene.traverse(function(child) {
      if  (child instanceof THREE.SkeletonHelper) child.update();
    });
    
    if (me.focus){
      var model = me.focus;
      var rig = model.rig;
      var v = new THREE.Vector3( rig.pos_x, rig.pos_y, rig.pos_z );
      camera.position.copy(v);
      camera.position.z += 1;
      camera.lookAt(v);
    }
  }
  
  function animate(){
    requestAnimationFrame(animate);
    render();
//    stats.update();     
    renderer.render(scene, camera);
  }
  
  init();
  
  $(window).resize(function(){
    var w = $(ME).width();
    var h = $(ME).height();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize( w, h );
  });
  
}

me.to3D = function(x,y){
  x -= $(ME).offset().left;
  y -= $(ME).offset().top;
  
  var thediv = $(ME);
  var W = thediv.width();
  var H = thediv.height();

  var vector = new THREE.Vector3();

  vector.set(
      ( x / W ) * 2 - 1,
      - ( y / H ) * 2 + 1,
      0.5 );

  vector.unproject( camera );

  var dir = vector.sub( camera.position ).normalize();
  var distance = - camera.position.z / dir.z;
  var pos = camera.position.clone().add( dir.multiplyScalar( distance ) );
  return pos;
};
