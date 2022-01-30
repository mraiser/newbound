var me = this;
var ME = $('#'+me.UUID)[0];

var network = ME.DATA.network;

var pos1 = new THREE.Vector3();
var pos2 = new THREE.Vector3();
var dv = new THREE.Vector3();
var v = new THREE.Vector3();
var d = 0;
var count = 1;
var rig1 = null;
var rig2 = null;
var rapi = null;
var i = 0;
var c = 0;
var orb = null;
var tex = null;

me.lines = [];

me.click = function(event){
  network.focus(me);
};

//var MAXCONCURRENTAJAX = 2;
//if (typeof document.body.numajax == 'undefined') document.body.numajax = 0;

me.animate = function(model){
  me.model = model;
  model.data = ME.DATA;
  
  function refresh(){
    if (ME.DATA.connected){
      
      me.lastcheck = new Date().getTime();
      setTimeout(checkRefresh, 15000);
      json('../peerbot/remote/'+model.data.id+'/peerbot/lookup', 'uuids='+encodeURIComponent(network.uuids), function(result){
        console.log('######## json received from '+ME.DATA.name);
        while (me.lines[0]) me.model.scene.remove(me.lines.pop());
        me.cons = result;
      
        setTimeout(refresh, 10000);
      });
      
      
      
/*      
      if (!me.isneedtoKillAjax && document.body.numajax < MAXCONCURRENTAJAX) {
        document.body.numajax++;
        console.log('######## sending ajax to '+ME.DATA.name);

        me.isneedtoKillAjax = true;
        setTimeout(function() { if(me.isneedtoKillAjax) me.myAjaxCall.abort(); console.log('######## ajax KILLED to '+ME.DATA.name); }, 10000);
        
        me.myAjaxCall = $.getJSON('../peerbot/remote/'+model.data.id+'/peerbot/lookup?uuids='+encodeURIComponent(network.uuids), function(result){
          me.isneedtoKillAjax = false;
          console.log('######## json received from '+ME.DATA.name);
           while (me.lines[0]) me.model.scene.remove(me.lines.pop());
          me.cons = result;
          setTimeout(refresh, 5000);
        }).always(function() {
          me.isneedtoKillAjax = false;
          document.body.numajax--;
          console.log('######## ajax complete with '+ME.DATA.name);
        });
      }
      else setTimeout(refresh, 500);
*/      
      
      
      
      
    }
    else{
      while (me.lines[0]) me.model.scene.remove(me.lines.pop());
      setTimeout(refresh, 5000);
    }
  }
  refresh();
  
  
  
  function checkRefresh(){
    var delta = new Date().getTime() - me.lastcheck;
    if (delta > 15000){
      console.log("No response from "+ME.DATA.name+" in "+(delta/1000)+" seconds.");
      //debugger;
      // FIXME - No additional checks or refreshes will be performed unless original request gets response
    }
  }
  
  
};

me.render = function(model){
  count = 0;
  dv.set(0,0,0);
  rig1 = model.rig;
  pos1.set(rig1.pos_x,rig1.pos_y,rig1.pos_z);
  if (ME.DATA.connected){
    d = pos1.distanceTo(dv);
    dv.sub(pos1).normalize().multiplyScalar(0.1*d*d);
    count++;
  }

  for (i in network.all){
    if (i != ME.DATA.id){
      rapi = network.all[i].el.api;
      if (rapi && rapi.rig){
        rig2 = rapi.rig;
        pos2.set(rig2.pos_x,rig2.pos_y,rig2.pos_z);
        d = pos2.distanceTo(pos1);
        v.copy(pos1).sub(pos2).normalize().multiplyScalar(1/(d*d));
        dv.add(v);
        count++;
        
        if (me.cons && rapi.data && me.cons[rapi.data.id]){
          var con = me.cons[rapi.data.id];
          if (con.connected){
            if (!rapi.api.cons) rapi.api.cons = {};
            if (!rapi.api.cons[ME.DATA.id]) rapi.api.cons[ME.DATA.id] = con;
            var r1 = me.model.rig;
            var r2 = rapi.rig;
            if (ME.DATA.connected && rapi.data.connected && !con.line){
              
              
              var points = [];
              points.push(
                new THREE.Vector3(r1.pos_x,r1.pos_y,r1.pos_z),
                new THREE.Vector3(r2.pos_x,r2.pos_y,r2.pos_z)
              );
              var geometry = new THREE.BufferGeometry().setFromPoints( points );
              
              
              
//              var geometry = new THREE.Geometry();
//              geometry.vertices.push(
//                  new THREE.Vector3(r1.pos_x,r1.pos_y,r1.pos_z),
//                  new THREE.Vector3(r2.pos_x,r2.pos_y,r2.pos_z)
//              );
              var color = con.tcp ? 0x00ff00 : con.udp ? 0x0000ff : 0xffff00;
              var material = new THREE.LineBasicMaterial( { color: color } );
              var mesh = new THREE.Line( geometry, material );
              me.model.scene.add(mesh);
              con.line = mesh;
              me.lines.push(mesh);
            }
            else if (ME.DATA.connected && rapi.data.connected){
              var p = con.line.geometry.attributes.position.array;
              p[0] = r1.pos_x;
              p[1] = r1.pos_y;
              p[2] = r1.pos_z;
              p[3] = r2.pos_x;
              p[4] = r2.pos_y;
              p[5] = r2.pos_z;
              con.line.geometry.attributes.position.needsUpdate = true;
              var vs = [ new THREE.Vector3(r1.pos_x,r1.pos_y,r1.pos_z), new THREE.Vector3(r2.pos_x,r2.pos_y,r2.pos_z) ];

//              var vs = con.line.geometry.vertices;
//              vs[0].set(r1.pos_x,r1.pos_y,r1.pos_z);
//              vs[1].set(r2.pos_x,r2.pos_y,r2.pos_z);
//              con.line.geometry.verticesNeedUpdate = true;
              if (con.tcp || con.udp){
                d = vs[1].distanceTo(vs[0]);
                v.copy(vs[1]).sub(vs[0]).normalize().multiplyScalar(0.01*d*d);
                dv.add(v);
                count++;
                con.line.material.color.r = 0;
                con.line.material.color.g = con.tcp ? 0.5 : 0;
                con.line.material.color.b = con.udp ? 0.5 : 0;
              }
              else{
                con.line.material.color.r = 0.5;
                con.line.material.color.g = 0.5;
                con.line.material.color.b = 0;
              }
            }
            else {
              if (con.line){
                var w = me.lines.indexOf(con.line);
                if (w != -1) {
                  me.model.scene.remove(con.line);
                  me.lines.splice(w,1);
                }
              }
            }
          }
          else{
            if (con.line){
              var w = me.lines.indexOf(me.line);
              if (w != -1) {
                me.model.scene.remove(me.line);
                me.lines.splice(w,1);
              }
            }
          }
        }
      }
    }
  }

  if (count>0){
    dv.multiplyScalar(1/count);

    rig1.pos_x += dv.x;
    rig1.pos_y += dv.y;
    rig1.pos_z += dv.z;
  }
  
  if (me.children && me.children[0] && me.children[0].api){
    orb = me.children[0].api;
    
    if (orb.model.rig){
      rig2 = orb.model.rig;
      rig2.rot_y += rig1.speed/25; //0.01;
      if (rig2.rot_y > TWOPI) rig2.rot_y -= TWOPI;
    }
    
    c = 1 - Math.min(1, 1/((new Date().getTime() - ME.DATA.lastcontact + network.timedelta)/15000));
    if (ME.DATA.connected){
      if (ME.DATA.tcp) orb.setColor(c,1,c);
      else if (ME.DATA.udp) orb.setColor(c,c,1);
      else orb.setColor(1,1,c);
    }
    else orb.setColor(1,1,1);
  }

  if (me.children && me.children[1] && me.children[1].api){
    tex = me.children[1].api;
    if (tex.data.text != ME.DATA.name) {
      if (tex.setText) tex.setText(ME.DATA.name);
      else tex.data.name = ME.DATA.name;
      me.children[1].models[0].geometry.center();
    }
    rig1.rot_x = me.model.scene.camera.rotation.x;
    rig1.rot_y = me.model.scene.camera.rotation.y;
    rig1.rot_z = me.model.scene.camera.rotation.z;
  }
};

var TWOPI = Math.Pi * 2;