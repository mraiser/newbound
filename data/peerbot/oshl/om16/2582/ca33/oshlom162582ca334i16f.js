var me = this;
var ME = $('#'+me.UUID)[0];

var zero = new THREE.Vector3( 0, 0, 0 );
var lines = {};
var lastcheck = 0;

me.animate = function(model){
  var rig = model.rig;
  var animations = model.animations;
  var camera = model.scene.camera;
  
  var cons = null;

  function addLine(start, stop, color){
    console.log('adding a line...');
      var material = new THREE.LineBasicMaterial({
          color: color
      });

      var geometry = new THREE.Geometry();
      geometry.vertices.push(
          start,
          stop
      );

      var line = new THREE.Line( geometry, material );
      model.scene.add( line );

    return line;
  }

  function addText(text, pos, font, color){
    var textMaterial = new THREE.MeshPhongMaterial( 
      { color: color, specular: 0xffffff }
    );

    var textGeometry = buildTextGeo(text, font);
    THREE.GeometryUtils.center( textGeometry )

    var mesh = new THREE.Mesh( textGeometry, textMaterial );
    mesh.position.copy(pos);
    mesh.scale.x = 0.001;
    mesh.scale.y = 0.001;
    mesh.scale.z = 0.001;
    model.scene.add( mesh );

    return mesh;
  }

  if (false && $(ME).data('peer').connected){
    var start = new THREE.Vector3( rig.pos_x, rig.pos_y, rig.pos_z );
    me.line = addLine(start, zero, 0xff0000);
  }
  
  animations.push(function(model){
    debugger;
    var name = $(ME).data('peer').name;
    if (me.text3d && me.lastname != name) {
      model.scene.remove( me.text3d );
      me.text3d = null;
    }
    if (!me.text3d) {
      me.text3d = model.text3d = addText(name, new THREE.Vector3( rig.pos_x, rig.pos_y, rig.pos_z ), font, 0xFFFFFF); 
      me.lastname = name;
    }
    
    var p = $(ME).data('peer');

    var c = model.models[0] ? model.models[0].material[0].color : {};
    if (p.connected) {
debugger;      
//      console.log(p.millis);
      c.b = Math.max(0, Math.min(1, (p.millis - 10000)/10000)); //p.millis < 10000 ? 0 : 0.5;
      c.g = p.udp ? 0.2 : 0.403921568627451;
      c.r = p.tcp ? 0.1843137254901961 : p.udp ? 0.2 : 0.4;
    }
    else{
      c.b = 0.5;
      c.g = 0.5;
      c.r = 0.5;
      cons = null;
    }
    
    rig.rot_y += 0.01;
    
    var a = new THREE.Vector3( rig.pos_x, rig.pos_y, rig.pos_z );
    var l = a.distanceTo(zero);
    
    if (p.connected){
      if (l>2){
        var d = 0.999;
        rig.pos_x *= d;
        rig.pos_y *= d;
        rig.pos_z *= d;
      }
    }
    else{
      if (l<10){
        var d = 1.001;
        rig.pos_x *= d;
        rig.pos_y *= d;
        rig.pos_z *= d;
      }
      for (var id in lines){
        model.scene.remove(lines[id]);
        delete lines[id];
      }
    }
    
    var v1 = new THREE.Vector3( rig.pos_x, rig.pos_y, rig.pos_z );
    
    $('.peerorb').each(function(x, el2){
      if (el2.id != p.id && el2.api && el2.api.rig){
        var p2 = cons ? cons[el2.id] : null;
        var rig2 = el2.api.rig;
        var v2 = new THREE.Vector3( rig2.pos_x, rig2.pos_y, rig2.pos_z );

        var l = v1.distanceTo(v2);
        var d = v2.clone();
        d.sub(v1);
        d.normalize();
        d.multiplyScalar(0.01);

        if (l<2) {
          v1.sub(d)
        }
        else {
          if (l>4 && p2 && p2.connected) v1.add(d);
        }

        rig.pos_x = v1.x;
        rig.pos_y = v1.y;
        rig.pos_z = v1.z;
        
        if (p2 && p2.connected){
//          var c = p2.tcp ? 0x00ffff : 0x0000ff;
          if (lines[el2.id]){
            lines[el2.id].geometry.vertices[0] = v1;
            lines[el2.id].geometry.vertices[1] = v2;
            lines[el2.id].geometry.verticesNeedUpdate = true;
            lines[el2.id].material.color.r = p2.tcp ? 0 : p.udp ? 0.2 : 0.4;
            lines[el2.id].material.color.g = p.udp ? 0.2 : 0.4;
//            lines[el2.id].material.color.b = 0;
//            debugger;
            lines[el2.id].material.color.b = p.oldlastcontact == p.lastcontact ? 0 : 1;
            p.oldlastcontact = p.lastcontact;
//            lines[el2.id].material.color.r = Math.random();
          }
          else {
            lines[el2.id] = addLine(v1, v2, c);
          }
        }
        else if (lines[el2.id]){
          model.scene.remove(lines[el2.id]);
          delete lines[el2.id];
        }
      }
    });
    
    if (me.line) {
      var v = me.line.geometry.vertices[0];
      v.x = rig.pos_x;
      v.y = rig.pos_y;
      v.z = rig.pos_z;
      me.line.geometry.verticesNeedUpdate = true;
//      me.line.updateMatrix();
    }
    
    if (me.text3d) {
      me.text3d.position.copy(v1);
      me.text3d.position.y += 0.3;
      me.text3d.rotation.copy(camera.rotation);
    }
    
    var now = new Date().getTime();
//    if (NUMREMOTECHECKS < 2 && now - lastcheck > 10000 && cons == null && $(ME).data('peer').connected) {
    if (now - lastcheck > 10000 && $(ME).data('peer').connected) {
      lastcheck = now;
//      NUMREMOTECHECKS++;
      json('../peerbot/remote/'+$(ME).data('peer').id+'/peerbot/lookup', 'uuids='+encodeURIComponent(document.body.ALLPEERIDS), function(result){
//        NUMREMOTECHECKS--;
        cons = result;
      });
    }
    
    
  });
};

//NUMREMOTECHECKS = 0;

function distanceVector( v1, v2 )
{
    var dx = v1.x - v2.x;
    var dy = v1.y - v2.y;
    var dz = v1.z - v2.z;

    return Math.sqrt( dx * dx + dy * dy + dz * dz );
}

function buildTextGeo(text, font){
    var textGeo = new THREE.TextGeometry( text, {
		font: font,
		size: 80,
		height: 5,
		curveSegments: 12,
		bevelEnabled: false,
		bevelThickness: 10,
		bevelSize: 8,
		bevelSegments: 5
	} );
    return textGeo;
}



