var me = this;
var ME = $('#'+me.UUID)[0];

var container, stats, clock, controls;
var camera, scene, renderer, mixer, models, avatar, toload;

var datprefix = $(ME).data('datguipath') ? $(ME).data('datguipath') : '../test/dat.gui-master/';
var libprefix = $(ME).data('threepath') ? $(ME).data('threepath') : '../test/three.js-master/';
var libs = [
  'build/three.min.js',
  'examples/js/controls/OrbitControls.js',
  'examples/js/Detector.js',
  'examples/js/libs/stats.min.js'
];

models = me.models = [];
var count = 0;
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

me.add = function(el, db, id, cb){
  $(el).data('datgui', me.datGUI);
  $(el).data('scene', scene);
  $(el).data('db', db);

  installControl(el, db, id, function(api){
    var ani1 = $(el).data('animations');
    var ani2 = [];
    
    function loadModel(){
      installControl(el, db, "jsonloader", function(api){
        models.push(api);

        for (var i in ani2) 
          ani2[i].animate(api);
        if (cb) api.onload(cb);
      }, {});
    }    

    if (ani1){
      function loadNext(){
        if (ani1.list.length > 0){
          var ani = ani1.list.shift();
          installControl(el, db, ani, function(animation){
            ani2.push(animation);
            loadNext();
          }, {});
        }
        else loadModel();
      }
      loadNext();
    }
    else loadModel(api);
  }, {});
};

me.ready = function(){
  var libindex = 0;
  function loadNext(){
    if (libindex<libs.length) promise = doAfterLoading(promise, libprefix + libs[libindex++], loadNext);
    else  {
      if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

      toload = $(ME).data('controls');
      if (!toload) toload = [];
      
      startup();
    }
  }
  var promise = $.when(true);
  promise = doAfterLoading(promise,  datprefix+'build/dat.gui.min.js', loadNext);
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
  var SCREEN_WIDTH, SCREEN_HEIGHT;
  var loader, model;
  
  
  function init(){
    /*creates empty scene object and renderer*/
    scene = me.scene = new THREE.Scene();
    camera = scene.camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, .1, 500);
    renderer = new THREE.WebGLRenderer({antialias:true});
    
    renderer.setClearColor(0x333300);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMapEnabled= true;
    renderer.shadowMapSoft = true;
    
    /*add controls*/
    if ($(ME).data('orbitcontrols') == true){
      controls = new THREE.OrbitControls( camera, renderer.domElement );
      controls.addEventListener( 'change', render );
    }
    
    camera.position.x = 6;
    camera.position.y = 2;
    camera.position.z = 6;    
    camera.lookAt(scene.position);
    
    me.lastlook = new THREE.Vector3();
    me.lastlook.copy(scene.position);

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
    datGUI = me.datGUI = {}; //new dat.GUI();
//    datGUI.add(guiControls, "scene");
//    datGUI.close();

    datGUI.addFolder = function(){
      var f = {};
      var f2 = {};
      f.add = f2.name = function(){
        f2.onChange = function(){};
        return f2;
      };
      return f;
    };
    
    $("#webGL-container").append(renderer.domElement);
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
      var d = v.distanceTo(camera.position);
      
      var v2 = new THREE.Vector3();
      v2.copy(camera.position);
      v2.sub(v);
      if (d>1.1) {
        v2.multiplyScalar(0.02);
        camera.position.sub(v2);
        
        v2.copy(me.lastlook);
        v2.sub(v);
        v2.multiplyScalar(0.2);
        me.lastlook.sub(v2);
        camera.lookAt(me.lastlook);
      }
      else {
        v2.normalize();
        v2.add(v);
        camera.position.copy(v2);
        camera.lookAt(v);
      }
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
    SCREEN_WIDTH = window.innerWidth;
    SCREEN_HEIGHT = window.innerHeight;
    camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
    camera.updateProjectionMatrix();
    renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
  });
  
}