var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  componentHandler.upgradeAllRegistered();
};

me.animate = function(model){
  me.metadata = $(ME).data('metadata');
  var animations = model.animations;
  var current, step, start, nrig, drig, millis;
  animations.push(function(model){
    var now = new Date().getTime();
    if (current){
      var p = Math.min(1, (now - start)/millis);
      for (var i in drig){
        model.rig[i] = drig[i] + ((nrig[i] - drig[i])*p);
      }
      if (p == 1) {
        step++;
        if (step >= current.steps.length) current = null;
        else{
          start += millis;
          drig = {};
          var s = current.steps[step];
          var p = getByProperty(me.metadata.poses, "id", s.pose);
          nrig = p.pose;
          for (var i in model.rig) if (model.rig[i] != nrig[i]) drig[i] = model.rig[i];
          millis = Number(s.millis);  
        }
      }
    }
    else{
      var a = $(ME).data('animate');
      if (a){
        $(ME).data('animate', null);
        current = getByProperty(me.metadata.animations, 'id', a);
        step = 0;
        start = now;
        drig = {};
        var s = current.steps[step];
        var p = getByProperty(me.metadata.poses, "id", s.pose);
        nrig = p.pose;
        for (var i in model.rig) if (model.rig[i] != nrig[i]) drig[i] = model.rig[i];
        millis = Number(s.millis); 
      }
    }
  });
};