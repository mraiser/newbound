var me = this;
var ME = $('#'+me.UUID)[0];

me.poses = ME.DATA.poses = ME.DATA.poses ? ME.DATA.poses : [];
me.animations = ME.DATA.animations = ME.DATA.animations ? ME.DATA.animations : [{}];

me.ready = function(){
  if (me.poses.length == 0) $(ME).find('.alist').html('<i>Poses are required to create animations, but you have none. Create some poses first.</i>');
  else {
    $(ME).find('.addanimation').removeClass('hideme').click(addAnimation);
    rebuildAnimations();
  }

  componentHandler.upgradeAllRegistered();
};

function addAnimation(){
  var a = {
    name: "Untitled",
    id: guid(),
    steps:[{}]
  };
  editAnimation(a);
}

function editAnimation(a){
  me.animation = a;
  var el = $(ME).find('.aeditor');
  installControl(el[0], 'metabot', 'popupdialog', function(api){
    setTimeout(function(){
      rebuildAnimation();
      $(ME).find('.addanimationpose').click(function(){
        me.animation.steps.push({});
        rebuildAnimation();
      });
      $(ME).find('.saveanimationlistbutton').click(function(){
        if (getByProperty(me.animations, "id", me.animation.id) == null) 
          me.animations.push(me.animation);
        me.animation.name = $('#animationname').val();
        me.animation.steps = extractSteps();
        $(ME).find('.aeditor')[0].api.closeAndReset();
        saveAnimations();
      });
      var i = me.animations.indexOf(me.animation);
      if (i != -1){
        $(ME).find('.deleteanimationbutton').css('display', 'inline-block').click(function(){
          me.animations.splice(i,1);
          $(ME).find('.aeditor')[0].api.closeAndReset();
          saveAnimations();
        });
      }
      else{
        $(ME).find('.deleteanimationbutton').css('display', 'none');
      }
    }, 1000);
  }, {});
}

function extractSteps(){
  var steps = [];
  var divs = $(ME).find('.aplist').find('.animationstep');
  var n = divs.length;
  for (var i=0;i<n;i++){
    var div = $(divs[i]);
    var millis = div.find('.apmillis').find('input').val();
    var pose = div.find('.apselect').find('select').val();
    var data = {
      millis:millis,
      pose:pose
    };
    steps.push(data);
  }
  return steps;
}

function saveAnimations(){
  ME.DATA.cb();
  rebuildAnimations();
}

function rebuildAnimations(){
  var el = $(ME).find('.alist');
  var newhtml = '';
  for (var i in me.animations){
    var a = me.animations[i];
    var name = a.name = a.name ? a.name : "Untitled";
    var id = a.id = a.id ? a.id : guid();
    var steps = a.steps = a.steps ? a.steps : [];
    newhtml += '<span class="mdl-chip mdl-chip--deletable clickme" data-index="'+i+'"><span class="mdl-chip__text">'+name+'</span><button type="button" class="mdl-chip__action"><i class="material-icons">edit</i></button></span>';
  }
  if (newhtml != '') newhtml += '<br><br>';
  el.html(newhtml);
  el.find('.mdl-chip__text').click(function(){
    var i = $(this).parent().data('index');
    var a = me.animations[i];
//    $('#Model').data('animate', a.id);
    $(ME).closest('.ctllistwrap').parent()[0].api.setMotion(a.id);
  });
  el.find('.mdl-chip__action').click(function(){
    var i = $(this).parent().data('index');
    var a = me.animations[i];
    editAnimation(a);
  });
}

function rebuildAnimation(){
  var a = me.animation;
  $('#animationname').val(a.name).parent()[0].MaterialTextfield.checkDirty();
  var div = $(ME).find('.aplist');
  div.empty();
  for (var i in a.steps){
    var s = a.steps[i];
    var data = {
      poses: me.poses,
      animation: s
    }
    var el = $('<div class="animationstep"/>');
    div.append('Step '+(Number(i)+1)+':');
    div.append(el);
    installControl(el[0], 'threejs', 'animationeditor', function(api){}, data);
  }
}