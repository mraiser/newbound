var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(api){
  componentHandler.upgradeAllRegistered();

  me.models = {};
  var el = $(ME).find('.matrixviewer');
  el.data('orbitcontrols', true);
  el.data('showdatgui', true);
  
  function addModel(el, ctl, cb){
    me.viewer.add(el[0], ctl.db, ctl.id, function(model){
      me.models[ctl.uuid] = model;
      cb();
    }, ctl);
  }
  
  function addAsset(el, a, cb){
    var assets = [ a.db+":"+a.id];
    me.viewer.loadModel(el[0], assets, null, a.db, a.pos, a.rot, a.scale, function(model){
      //me.models[a.uuid] = model;
      cb();
    }, a);
  }
  
  installControl(el[0], 'threejs', 'viewer', function(api){
    me.viewer = api;
    api.waitReady(function(){
      var scene = me.viewer.scene;
      var camera = scene.camera;
      camera.position.set(0,0,-10);
      camera.position.x = 0;
      camera.position.y = 0;
      camera.position.z = 10;    
      camera.lookAt(scene.position);
      me.data = ME.DATA;
      if (!me.data) me.data = {};
      if (!me.data.three) me.data.three = { "controls": [] };
      if (!me.data.three.assets) me.data.three.assets = [];
      
      
      
      
      var l = me.queue = me.data.three.controls.slice();
      var l2 = me.queue2 = me.data.three.assets.slice();
      var popnext = me.popnext = function(){
        if (l.length>0){
          var ctl = l.shift();
          if (!ctl.uuid) ctl.uuid = guid();
          var el = $('<div id="'+ctl.uuid+'"/>');
          console.log(JSON.stringify(ctl));
          $(ME).append(el);
          addModel(el, ctl, popnext);
        }
        else if (l2.length>0){
          var asset = l2.shift();
          if (!asset.uuid) asset.uuid = guid();
          var el = $('<div id="'+asset.uuid+'"/>');
          console.log(JSON.stringify(asset));
          $(ME).append(el);
          addAsset(el, asset, popnext);
        }
        else start();
      };
      popnext();
    });
  }, {});
};

function dirty(){
  $('.savebutton').removeClass('mdl-button--accent').addClass('mdl-button--colored');
}
me.dirty = dirty;

function start(){
  startctl();
  startasset();
  rebuildPoses();
  rebuildBehaviors();
}

function rebuildBehaviors(){
  var data = {};
  data.behaviors = me.behaviors = me.data.three.behaviors = me.data.three.behaviors ? me.data.three.behaviors : [];
  var el = $(ME).find('.behaviorlistgoeshere');
  installControl(el[0], "metabot", "behaviorlist", function(api){
    api.parent = me;
  }, data);
}

function startctl(){
  startlist('ctl', me.data.three.controls);
}

function startasset(){
  startlist('asset', me.data.three.assets);
}

function rebuildPoses(){
  var newhtml = '';
  
  me.poses = me.data.three.poses = me.data.three.poses ? me.data.three.poses : [];
  me.animations = me.data.three.animations = me.data.three.animations ? me.data.three.animations : [];
  
  for (var i in me.poses){
    var p = me.poses[i];
    newhtml += '<span class="mdl-chip mdl-chip--deletable clickme" data-index="'+i+'"><span class="mdl-chip__text">'+p.name+'</span><button type="button" class="mdl-chip__action"><i class="material-icons">cancel</i></button></span>';
    if (!p.id) p.id = guid();
  }
  if (newhtml != '') newhtml += '<br><br>';
  var el = $(ME).find('.poselistgoeshere');
  el.html(newhtml);
  el.find('.mdl-chip__text').click(function(){
    var i = $(this).parent().data('index');
    var p = me.poses[i];
    setPose(p);
  });;
  el.find('.mdl-chip__action').click(function(){
    var i = $(this).parent().data('index');
    var data = {
      title:"Delete Pose",
      text:"Are you sure you want to delete this pose?",
      cb:function(){
        me.poses.splice(i,1);
        dirty();
        rebuildPoses();
      }
    }
    installControl('#popmeup2', 'metabot', 'confirmdialog', function(result){}, data);
  });;
  componentHandler.upgradeAllRegistered();
  
  var el = $(ME).find('.animationlistgoeshere');
  var data = {
    "poses": me.poses,
    "animations": me.animations,
    "cb": function(data){
      dirty();
    }
  };
  installControl(el[0], 'threejs', 'animationlist', function(result){}, data);
}

function startlist(type, list){
  var newhtml = '<ul class="demo-list-'+type+' mdl-list">';
  for (var i in list){
    var ctl = list[i];
    var name = ctl.name ? ctl.name : ctl.id;
    newhtml += '<li class="mdl-list__item mdl-list__item--two-line" data-index="'+i+'" id="li_'+ctl.uuid+'"><span class="mdl-list__item-primary-content editctl"><span class="namespan">'+name+'</span><span class="mdl-list__item-sub-title">'+ctl.db+':'+ctl.id+'</span></span><a class="mdl-list__item-secondary-action delctl" href="#"><i class="material-icons">delete</i></a></li>';
  }
  newhtml += '</ul>';
  var el = $(ME).find('.'+type+'list');
  el.html(newhtml);
  el.find('.delctl').click(function(){
    var i = $(this).closest('li').data('index');
    var d = list.splice(i,1);
    start();
    var m1 = $('#'+d[0].uuid)[0].api;
    me.viewer.removeModel(m1);
    delete me.models[m1.modelid];
  });
  el.find('.editctl').click(function(){
    var i = $(this).closest('li').data('index');
    var d = list[i];
    var m1 = $('#'+d.uuid)[0].api;

    me.edit3d = d;
    $('#edit3dctlname').val(d.name).parent()[0].MaterialTextfield.checkDirty();

    d.pos = d.pos ? d.pos : {"x":0,"y":0,"z":0};
    d.rot = d.rot ? d.rot : {"x":0,"y":0,"z":0};
    d.scale = d.scale ? d.scale : {"x":1,"y":1,"z":1};
    
    var vpos = {
      "value": d.pos,
      "cb":function(val){
        m1.rig.pos_x = val.x;
        m1.rig.pos_y = val.y;
        m1.rig.pos_z = val.z;
        dirty();
      }
    };
    var vrot = {
      "value": d.rot,
      "cb":function(val){
        m1.rig.rot_x = val.x;
        m1.rig.rot_y = val.y;
        m1.rig.rot_z = val.z;
        dirty();
      }
    };
    var vscale = {
      "value": d.scale,
      "cb":function(val){
        m1.rig.scale_x = val.x;
        m1.rig.scale_y = val.y;
        m1.rig.scale_z = val.z;
        dirty();
      }
    };
    installControl('#edit3dctlpos', 'threejs', 'vector3', function(api){}, vpos);
    installControl('#edit3dctlrot', 'threejs', 'vector3', function(api){}, vrot);
    installControl('#edit3dctlscale', 'threejs', 'vector3', function(api){}, vscale);

    $('#edit3dctlinner').empty();
    $('.edit3dhere').css('display', 'block');
    if (m1.api && m1.api.edit) {
      m1.api.edit('#edit3dctlinner', function(val){
        dirty();
      });
    }
  });
}

$('#add3dassetbutton').click(function(){
  var api = $('#new3dasset')[0].api;
  var lib = api.lib;
  var asset = api.value();

  var d = {
    "name":asset,
    "id":asset,
    "db":lib
  };
  console.log(d);
  me.queue2.push(d);
  me.popnext();
  me.data.three.assets.push(d);
  start();
});

$('#add3dctlbutton').click(function(){
  var api = $('#new3dctl')[0].api;
  var lib = api.lib;
  var ctl = api.value();
  var name = api.name();

  var d = {
    "name":name,
    "id":ctl,
    "db":lib
  };
  me.queue.push(d);
  me.popnext();
  me.data.three.controls.push(d);
  start();
});

$('#edit3dctlname').change(function(){
  var el = $('#li_'+me.edit3d.uuid);
  me.edit3d.name = $(this).val();
  el.find('.namespan').text(me.edit3d.name);
  dirty();
});

$(ME).find('.3dtab').click(function(){
  if ($(this).hasClass("posetab")){
    $('.dg.ac').css('display', 'block');
    $('.editbehaviorhere').css('display', 'none');
    $('.dg.main.a').css('width', '400px');
    $('.edit3dhere').css('display', 'none');
  }
  else if($(this).hasClass("behaviortab")){
    $('.editbehaviorhere').css('display', 'block').empty();
    $('.dg.ac').css('display', 'none');
    $('.edit3dhere').css('display', 'none');
  }
  else if($(this).hasClass("controltab")){
    $('.edit3dhere').css('display', 'none');
    $('.editbehaviorhere').css('display', 'none');
    $('.dg.ac').css('display', 'none');
  }
  else{
    $('.dg.ac').css('display', 'none');
    $('.editbehaviorhere').css('display', 'none');
    $('.edit3dhere').css('display', 'none');
  }
});

$(ME).find('.newposebutton').click(function(){
  
  function cb(val){
    var rig = {};
    for (var i in me.models)
      rig[i] = Object.assign({}, me.models[i].rig);
    
    var pose = {
      "name": val,
      "id": guid(),
      "pose": rig
    };
    
    me.poses.push(pose);
    rebuildPoses();
    dirty();
  }
  
  var data = {
    "title": "New Pose",
    "text": "Enter a name for the new pose",
    "subtext": "",
    "cb": cb
  };
  
  installControl('#popmeup2', 'metabot', 'promptdialog', null, data);
});

function setPose(pose, millis, cb){
  if (!millis) millis = 500;
  for (var mid in me.models) {
    me.models[mid].setPose(pose.pose[mid], millis, cb);
    cb = null;
  }
}
me.setPose = setPose;

function setMotion(motionname, cb){
  var motion = getByProperty(me.animations, "name", motionname);
  if (!motion) motion = getByProperty(me.animations, "id", motionname);
  var l = motion.steps.slice();
  function popNext(){
    if (l.length>0){
      var step = l.shift();
      var pose = getByProperty(me.poses, "id", step.pose);
      me.setPose(pose, step.millis, popNext);
    }
    else if (cb) cb();
  }
  popNext();
}
me.setMotion = setMotion;
