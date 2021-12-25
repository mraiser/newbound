var me = this;
var ME = $('#'+me.UUID)[0];

//me.list = [];
me.all = {};
me.viewer = $(ME).data('scene').viewer;

me.ready = function(){
  me.center = new THREE.Vector3(-60,-20,-60);
  me.recenter = new THREE.Vector3(0,0,0);
  me.camv = new THREE.Vector3(0,0,0);
  me.distance = 10;
  me.redistance = 10;
  me.olddistance = 10;
  me.now = new Date().getTime()
  me.refresh();
  WSCB = function(data){
    add(data.data);
  };
};

me.refresh = function(){
  if ($(document.body).find(me.UUID == ME)){
    json('../peerbot/connections', null, function(result){
      if (result.status == 'ok') {
        me.peers = document.peers = result.data;
        me.timedelta = new Date().getTime() - result.currenttimemillis;
        for (var i in result.data) {
          var p = result.data[i];
          p.millis = result.currenttimemillis - p.lastcontact;
          add(p);
        }
        setTimeout(me.refresh, 5000);
      }
    });
  }
}

me.focus = function(m){
  if (m && (m != me.selected)){
    if (!me.selected) me.olddistance =  me.distance = me.model.scene.camera.position.distanceTo(me.center);
    me.selected = m;
    var rig = m.model.rig;
    me.recenter.set(rig.pos_x,rig.pos_y,rig.pos_z);
    me.redistance = 1;
  }
  else {
    me.selected = null;
    me.recenter.set(0,0,0);
    me.redistance = me.olddistance;
    delete CURRENTDEVICEID;
    delete CURRENTDEVICEPREFIX;
  }
  if (me.networkviewer) me.networkviewer.select(me.selected);
};

me.render = function(model){
  me.now = new Date().getTime()
  if (me.selected){
    var rig = me.selected.model.rig;
    me.recenter.set(rig.pos_x,rig.pos_y,rig.pos_z);
    $('.hudms').text(((me.now+me.timedelta-me.selected.model.data.lastcontact)/1000).toFixed(1)+'s');
  }
  if (me.redistance){
    var delta = me.redistance - me.distance;
    if (!me.selected && delta < 0.001) me.redistance = null;
    else {
      me.distance = (delta * 0.1)+me.distance;
      model.scene.camera.getWorldDirection(me.camv);
      me.camv.negate().multiplyScalar(me.distance).add(me.center);
      model.scene.camera.position.copy(me.camv);
    }
  }
  me.camv.copy(me.recenter).sub(me.center).multiplyScalar(0.1);
  me.center.add(me.camv);
  model.scene.camera.lookAt(me.center);
};

me.delete = function(p){
  $('.closehud').click();
  
  var model = p.el.api;
  delete me.all[p.id];

  var rig = model.rig;
  var size = rig.scale_x;
  model.animations.push(function(model){
    if (size > 0.0001){
      size *= 0.8;
      rig.scale_x = size;
      rig.scale_y = size;
      rig.scale_z = size;
    }
    else {
      me.group.remove(model.group);
    }
  });
  
  json("deletepeer","uuid="+p.id, function(result) {});
};

function add(p){
  if (!me.all[p.id]) {
    me.uuids = me.uuids ? me.uuids+' '+p.id : p.id;
    me.all[p.id] = p;
    var el = $('<div class="peerorb" id="orb_'+p.id+'"/>');
    $('body').append(el);
    
    var num = p.id.hashCode();
    var count = 100000;
    var n = (num/count)*Math.PI*2;
    var s = 0.25;
    var r = 10; //((count*2)/Math.PI)/20;
    var q = 5-(num%11);
    var x = Math.sin(n)*r;
    var y = 0.1/(q?q:1);
    var z = Math.cos(n)*r;
    p.pos = new THREE.Vector3(x,y,z);
    p.scale = new THREE.Vector3(s,s,s);
    p.network = me;
    p.el = el[0];
    me.viewer.add(el[0], 'peerbot', 'peer', function(model){}, p, me.group);     
  }
  else {
    Object.assign(me.all[p.id], p);
  }
  if (me.networkviewer) me.networkviewer.update(me.all[p.id]);
}

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
