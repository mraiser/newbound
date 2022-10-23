var me = this;
var ME = $('#'+me.UUID)[0];

me.children = [];

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  ui.initNavbar(ME);
  ui.initPopups(ME);
};

me.ready = function(){
  subscribe_event("peer", "UPDATE", function(data){
    var pdiv = $(ME).find('#peer_'+data.id)[0];
    if (pdiv) pdiv.DATA = data;
    else addPeer(data);
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

              var spotLight = me. spotLight = new THREE.SpotLight(0xffffff);
              spotLight.castShadow = true;
              spotLight.position.set (20, 35, 40);
              scene.add(spotLight);

              camera.position.z = 5;
              camera.lookAt(scene.position);
              
              me.camv = new THREE.Vector3();
              me.recenter = new THREE.Vector3();
              me.center = new THREE.Vector3();
              me.center.copy(scene.position);
              
              me.distance = 10;
              me.redistance = 10;
              me.olddistance = 10;

              send_peers(function(result){
                me.peers = result.data;
                for (var i in result.data) {
                  var p = result.data[i];
                  addPeer(p);
                }
                send_info(null, null, null, function(result){
                  me.info = result.data;
                  $(ME).find('.localpeername').text(result.data.name);
                  $(ME).find('.localpeerid').text(result.data.uuid);
                  $(ME).find('.localpeerport').text("P2P Port: "+result.data.p2p_port);
                  $(ME).find('.localhttpport').text("HTTP Port: "+result.data.http_port);
                  
                  json('../app/libs', null, function(result) {
                    document.body.locallibraries = result.data;
                  });
                  
                  json('../security/groups', null, function(result){
                    if (result.status != 'ok') alert(result.msg);
                    else {
                      me.groups = result.data;
                      result.data.sort();
                      var newhtml = '';
                      for (var i in result.data) {
                        newhtml += '<option>'+result.data[i]+'</option>';
                      }
                      $(ME).find('.groupselect').html(newhtml).val('anonymous');
                    }
                  });
                });
              });

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
};

$(ME).find('.addpeerbutton').click(function(){
  json('../peer/discovery', null, function(result){
    me.discovery = result.data;
    var newhtml = '';
    var now = new Date().getTime();
    for (sip in result.data) {
      var rds = result.data[sip];
      if (now - rds.time < 30000 && !getByProperty(me.peers, "id", rds.uuid)) {
        newhtml += '<tr class="clickme" data-sip="'+sip+'"><td>'+sip+'</td><td>'+rds.name+'</td><td><span class="smalltext">'+rds.uuid+'</span></td></tr>';
      }
    }
    if (newhtml == '') newhtml = '<div class="padme"><i>No new devices found on LAN</i></div>';
    else newhtml = '<table class="lantable" border="0" cellpadding="0" cellspacing="20">' + newhtml + '</table>';
    $(ME).find('.discovered').html(newhtml).find('.clickme').click(function(){
      var sip = $(this).data('sip');
      var rds = me.discovery[sip];
      $(ME).find('.autab2').click();
      $(ME).find('.addusername').val(rds.name);
      $(ME).find('.adduseruuid').val(rds.uuid);
      $(ME).find('.adduseripaddr').val(rds.address);
      $(ME).find('.adduserport').val(rds.p2pport);
    });
  });
});

$(ME).find('#addconnection').click(function(){
  var el_uuid = $(ME).find('.adduseruuid');
  el_uuid.parent().css('border', 'none');
  var uuid = el_uuid.val();
  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
  if (!regexExp.test(uuid)) {
    el_uuid.parent().css('border', 'thin red solid');
    document.body.api.ui.snackbar({"message":"A valid device ID is required"});
  }
  else if (uuid == me.info.uuid) {
    el_uuid.parent().css('border', 'thin red solid');
    document.body.api.ui.snackbar({"message":"You cannot connect to yourself"});
  }
  else {
    $(ME).find('.close-add-user').click();
    var rando = guid();
    var display = $(ME).find('.addusername').val();
    var keepalive = $(ME).find('#useraddkeepalive').prop('checked');
    var group = JSON.stringify([$(ME).find('.addusergroup').val()]);
    var address = $(ME).find('.adduseripaddr').val();
    var port = $(ME).find('.adduserport').val();
    var params = "id="+encodeURIComponent(uuid)
      + "&displayname="+encodeURIComponent(display)
      + "&password="+encodeURIComponent(rando)
      + "&groups="+encodeURIComponent(group)
      + "&keepalive="+keepalive
      + "&address="+encodeURIComponent(address)
      + "&port="+encodeURIComponent(port);
    json('../security/setuser', params, function(result){
      var params = "ipaddr="+encodeURIComponent(address)
        + "&port="+encodeURIComponent(port);
      json('../peer/udp_connect', params, function(result){
        
      });
    });
  }
});

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

me.focus = function(m){
  if (m && (m != me.selected)){
    if (!me.selected) me.olddistance =  me.distance = me.camera.position.distanceTo(me.center);
    me.selected = m;
    me.recenter.copy(m.model.position);
    me.redistance = 1;
  }
  else {
    me.selected = null;
    me.recenter.set(0,0,0);
    me.redistance = me.olddistance;
  }
};

me.render = function(){
  for (var i in me.children){
    var kid = me.children[i];
    if (kid.render) kid.render();
  }

  if (me.selected){
    me.recenter.copy(me.selected.model.position);
    //$('.hudms').text(((me.now+me.timedelta-me.selected.model.data.lastcontact)/1000).toFixed(1)+'s');
  }
  if (me.redistance){
    var delta = me.redistance - me.distance;
    if (!me.selected && delta < 0.001) me.redistance = null;
    else {
      me.distance = (delta * 0.1)+me.distance;
      me.camera.getWorldDirection(me.camv);
      me.camv.negate().multiplyScalar(me.distance).add(me.center);
      me.camera.position.copy(me.camv);
    }
  }
  
  me.camv.copy(me.recenter).sub(me.center).multiplyScalar(0.1);
  me.center.add(me.camv);
  me.camera.lookAt(me.center);
  me.spotLight.position.copy(me.camera.position);
  me.renderer.render(me.scene, me.camera);
}

me.animate = function () {
  requestAnimationFrame(me.animate);
  me.render();
};

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


$(window).on("resize", function(e){
  var w = $(ME).width();
  var h = $(ME).height();
  $(ME).find("canvas").width(w).height(h);
  me.camera.aspect = w / h;
  me.camera.updateProjectionMatrix();
  me.renderer.setSize(w, h);
});