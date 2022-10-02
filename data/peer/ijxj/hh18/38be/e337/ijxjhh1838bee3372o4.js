var me = this;
var ME = $('#'+me.UUID)[0];

me.click = function(e) {
  var el = $('#headsupdisplay');
  el.width(0).css('display', 'block').animate({width:680}, 300);
  installControl(el[0], 'peer', 'headsup', function(api){}, ME.DATA);
};

me.animate = function(model) {
  var group = me.model;
  group.add(sphereMesh());
  group.add(textMesh(ME.DATA.displayname));
  me.lines = {};
  me.div = ME;
};

var v = new THREE.Vector3();
var dv = new THREE.Vector3();
var count = 0;

function sphereMesh(){
  var geometry = new THREE.IcosahedronGeometry( 1, 1 );
  var d = {
    color: 0x00ff00,
    metalness: 0.5,
    flatShading : true 
  };
  var material = new THREE.MeshStandardMaterial( d );
  var sphere = me.sphere = new THREE.Mesh( geometry, material );
  return sphere;
}

function textMesh(name){
  var d = {
    color: 0xffffff,
    metalness: 0.5,
    flatShading : true 
  };
  geometry = new THREE.TextGeometry( name, {
    font: document.body.font,
    size: 80,
    height: 5,
    curveSegments: 12,
    bevelEnabled: false,
    bevelThickness: 10,
    bevelSize: 8,
    bevelSegments: 5
  } );
  geometry.center();
  material = new THREE.MeshStandardMaterial( d );
  var mesh = me.text = new THREE.Mesh( geometry, material );
  mesh.scale.x = 0.01;
  mesh.scale.y = 0.01;
  mesh.scale.z = 0.01;
  mesh.position.y = 1.5;
  mesh.text = name;
  return mesh;
}

me.render = function(){
  me.sphere.rotation.y += 0.01;
  
  var pos1 = me.model.position;
  count = 0;
  dv.set(0,0,0);
  
  if (ME.DATA.connected){
    d = pos1.distanceTo(dv);
    dv.sub(pos1).normalize().multiplyScalar(0.1*d*d);
    count++;
  }

  for (var i in me.viewer.children) {
    var p = me.viewer.children[i];
    if (p.model && p != me) {
      var pos2 = p.model.position;
      d = pos2.distanceTo(pos1);
      v.copy(pos1).sub(pos2).normalize().multiplyScalar(1/(d*d));
      dv.add(v);
      count++;
      
      var rid = p.div.DATA.id;
      
      if (ME.DATA.peers && ME.DATA.peers[rid]) {
        var op = ME.DATA.peers[rid];
        if (!me.lines[rid]) {
          p.div.DATA.connected = true;
          var points = [];
          points.push(
            new THREE.Vector3(pos1.x,pos1.y,pos1.z),
            new THREE.Vector3(pos2.x,pos2.y,pos2.z)
          );
          var geometry = new THREE.BufferGeometry().setFromPoints( points );
          var color = op.startsWith('tcp#') ? 0x00ff00 : op.startsWith('udp#') ? 0x0000ff : 0xffff00;
          var material = new THREE.LineBasicMaterial( { color: color } );
          var mesh = new THREE.Line( geometry, material );
          me.viewer.scene.add(mesh);
          me.lines[rid] = mesh;
        }
        
        var line = me.lines[rid];
        
        var p = line.geometry.attributes.position.array;
        p[0] = pos1.x;
        p[1] = pos1.y;
        p[2] = pos1.z;
        p[3] = pos2.x;
        p[4] = pos2.y;
        p[5] = pos2.z;
        line.geometry.attributes.position.needsUpdate = true;
        
        var tcp = op.startsWith('tcp#');
        var udp = op.startsWith('udp#');
        if (tcp || udp){
          d = pos2.distanceTo(pos1);
          v.copy(pos2).sub(pos1).normalize().multiplyScalar(0.01*d*d);
          dv.add(v);
          count++;
          line.material.color.r = 0;
          line.material.color.g = tcp ? 0.5 : 0;
          line.material.color.b = udp ? 0.5 : 0;
        }
        else{
          line.material.color.r = 0.5;
          line.material.color.g = 0.5;
          line.material.color.b = 0;
        }
        
        
        
      }
    }
  }
  
  if (count>0){
    dv.multiplyScalar(1/count);
    
    pos1.x += dv.x;
    pos1.y += dv.y;
    pos1.z += dv.z;
  }

  tex = me.text;
  if (tex.text != ME.DATA.displayname) {
	me.model.remove(tex);
    me.model.add(textMesh(ME.DATA.displayname));
  }
  
  let delta = Math.max(0, new Date().getTime() - ME.DATA.last_contact - 30000);
  var c = 1 - Math.min(1, 1/(delta/15000));
  if (ME.DATA.connected){
    if (ME.DATA.tcp) me.sphere.material.color.setRGB(c,1,c);
    else if (ME.DATA.udp) me.sphere.material.color.setRGB(c,c,1);
    else me.sphere.material.color.setRGB(1,1,c);
  }
  else me.sphere.material.color.setRGB(1,1,1);

  var mrot = me.model.rotation;
  var crot = me.viewer.camera.rotation;
  mrot.x = crot.x;
  mrot.y = crot.y;
  mrot.z = crot.z;
};