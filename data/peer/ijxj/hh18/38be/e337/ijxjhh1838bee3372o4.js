var me = this;
var ME = $('#'+me.UUID)[0];

me.animate = function(model) {
  var group = me.model;
  var geometry = new THREE.IcosahedronGeometry( 1, 1 );
  var d = {
    color: 0x00ff00,
    metalness: 0.5,
    flatShading : true 
  };
  var material = new THREE.MeshStandardMaterial( d );
  var sphere = me.sphere = new THREE.Mesh( geometry, material );
  group.add(sphere);

  geometry = new THREE.TextGeometry( ME.DATA.displayname, {
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
  d.color = 0xffffff;
  material = new THREE.MeshStandardMaterial( d );
  var mesh = me.text = new THREE.Mesh( geometry, material );
  mesh.scale.x = 0.01;
  mesh.scale.y = 0.01;
  mesh.scale.z = 0.01;
  mesh.position.y = 1.5;
  group.add(mesh);
};

me.render = function(){
  me.sphere.rotation.y += 0.01;
};