var N3DENGINE = N3DENGINE || { VERSION: '1' };

N3DENGINE.Scene = function(thediv) {
	this.models = new Array();
	this.meshes = new Array();
	this.scene = new THREE.Scene();
	this.renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
	this.camera = new THREE.PerspectiveCamera(75, $(thediv).width()/$(thediv).height(), 0.1, 1000);
//	this.camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, 1, 1000 );
//	this.camera = new THREE.CubeCamera( 1, 100000, 128 );
	
	this.raycaster = new THREE.Raycaster();
	this.mouse = new THREE.Vector2();
	
	$(thediv).append(this.renderer.domElement);
	
	var me = this;

	function resize() {
		var w = $(thediv).width();
		var h = $(thediv).height();
		var a = w / h;
    	me.camera.aspect = a;
    	me.camera.updateProjectionMatrix();
    	me.renderer.setSize(w, h);
	};
	resize();
	$(window).resize(resize);
	setTimeout(resize, 100);
	
	this.camerapan = 0;
	this.camerazoom = 5;
	this.cameraheight = 2;
	
	this.camera.position.z = 400;
	this.camera.position.y = 2;
	this.camera.lookAt(new THREE.Vector3( 0, 0, 0 ));
	
	var pointLight = new THREE.PointLight(0xFFFFFF, 1, 0);
	pointLight.position.x = 0;
	pointLight.position.y = 0;
	pointLight.position.z = 1000;
	this.scene.add(pointLight);
	
	var vector = new THREE.Vector3();
	
	$(thediv).mousemove(onDocumentMouseOver);
	$(thediv).mousedown(onDocumentMouseDown);
	$(thediv).mouseup(onDocumentMouseUp);
	$(thediv).click(onDocumentMouseClick);
//	window.addEventListener( "keyup", onDocumentKeyUp, true);
	
	function mouseCalc(event) {
		me.mouse.x = ( event.clientX / me.renderer.domElement.width ) * 2 - 1;
		me.mouse.y = - ( event.clientY / me.renderer.domElement.height ) * 2 + 1;

		me.raycaster.setFromCamera( me.mouse, me.camera );

		var intersects = me.raycaster.intersectObjects( me.meshes );
		return intersects;
		
/*		
var vector = new THREE.Vector3();

vector.set(
    ( event.clientX / window.innerWidth ) * 2 - 1,
    - ( event.clientY / window.innerHeight ) * 2 + 1,
    0.5 );

vector.unproject( camera );

var dir = vector.sub( camera.position ).normalize();

var distance = - camera.position.z / dir.z;

var pos = camera.position.clone().add( dir.multiplyScalar( distance ) );
//The variable pos is the position of the point in 3D space, "under the mouse", and in the plane z=0.
*/		
		
	}
	
	var DRAG = null;
	function onDocumentMouseOver(event){
		if (DRAG) DRAG.drag(event);
		else {
			var intersects = mouseCalc(event);
			if ( intersects.length > 0 ) {
				var m = intersects[0].object.model;
				if (m.mouseover) m.mouseover(event);
				if (me.lastover && me.lastover != m && me.lastover.mouseout) me.lastover.mouseout(event);
				me.lastover = m;
			}
			else {
				if (me.lastover && me.lastover.mouseout) me.lastover.mouseout(event);
				me.lastover = null;
			}
		}
	}

	function onDocumentMouseClick(event){
		var intersects = mouseCalc(event);
		if ( intersects.length > 0 ) {
			var m = intersects[0].object.model;
			if (m.click) m.click(event);
		}
		else if (me.click) me.click(event);
	}

	function onDocumentMouseDown(event){
		var intersects = mouseCalc(event);
		if ( intersects.length > 0 ) {
			var m = intersects[0].object.model;
			if (m.mousedown) m.mousedown(event);
			if (m.drag) DRAG = m;
		}
	}

	function onDocumentMouseUp(event){
		DRAG = null;
		var intersects = mouseCalc(event);
		if ( intersects.length > 0 ) {
			var m = intersects[0].object.model;
			if (m.mouseup) m.mouseup(event);
		}
	}

//	function onDocumentKeyUp(event){
//	  var e = event.keyCode;
//	  alert(e);
//	}

	function render() {
		requestAnimationFrame(render);
		
		var now = new Date().getTime();

		for (var i in me.models) {
			var model = me.models[i];
			if (model.state) model.state.apply(model);
			if (model.motion) model.motion(model);
			if (model.velocity) {
				var d = vector.distanceTo(model.velocity);
				if (d > 0) {
					d = (now - me.lastrender) * d / 1000;
					vector.copy(model.velocity);
					vector.y -= model.stepheight;
					vector.normalize();
					var ok = true;
					if (model.collision(model.ground, vector, 0, d)) {
						vector.copy(model.velocity);
						vector.normalize();
						if (model.collision(model.ground, vector, 0, d)) {
							vector.copy(model.velocity);
							vector.y += model.stepheight;
							vector.normalize();
							ok = !model.collision(model.ground, vector, 0, d);
						}
					}
					if (ok) {
						vector.multiplyScalar(d);
						model.mesh.position.add(vector);
					}
					else model.velocity.y = 0;
				}
			}
			if (model.ground) {
				vector.set(0,-1,0);
				if (!model.collision(model.ground, vector, 0, model.stepheight/5)) {
					if (model.mesh.position.y < model.ground.mesh.position.y - model.ground.min.y) { 
						model.mesh.position.y = model.ground.max.y * 1.1;
						model.velocity.y = 0;
					}
					else model.velocity.y -= (now - me.lastrender) / 100;
				}
				else model.velocity.y = 0;
			}
		}
		if (me.avatar && me.avatar.mesh) {
			var mesh = me.avatar.mesh;
			var roty = mesh.rotation.y + Math.PI + me.camerapan;
			var x = mesh.position.x + me.camerazoom * Math.sin(roty);
			var y = mesh.position.y + me.cameraheight;
			var z = mesh.position.z + me.camerazoom * Math.cos(roty);
			me.camera.position.set(x,y,z);
			me.camera.lookAt(mesh.position);
		}
		
		me.renderer.render(me.scene, me.camera);
		me.lastrender = now;
	};
	
	render();
};

N3DENGINE.Scene.prototype = {
		
		constructor: N3DENGINE.Scene,

		addModel: function(m) {
			this.scene.add(m.mesh);
			this.meshes.push(m.mesh);
			this.models.push(m);
		},
		
		removeModel: function(m) {
			this.scene.remove( m.mesh );
			var i = this.models.indexOf(m);
			if (i>-1) this.models.splice(i,1);
			i = this.meshes.indexOf(m.mesh);
			if (i>-1) this.meshes.splice(i,1);
		},
		
		clear: function() {
			var i = this.models.length;
			while (i-->0) this.removeModel(this.models[i]);
		}
};

N3DENGINE.ModelState = function(data) {
	this.selectors = data.selectors;
	this.motions = data.motions;
	this.states = data.states;
	this.vertices = data.model.vertices;

}

N3DENGINE.ModelState.prototype = {
		
		constructor: N3DENGINE.ModelState,
		
		m: new THREE.Matrix4(),
		m1: new THREE.Matrix4(),
		m2: new THREE.Matrix4(),
		m3: new THREE.Matrix4(),
		
		apply: function(model) {
			var mesh = model.mesh;
			var i = 0;
			var wVerts = mesh.geometry.vertices;
		    var n = wVerts.length;
			var m = this.m;
			var m1 = this.m1;
			var m2 = this.m2;
			var m3 = this.m3;

		    for (var j=0; j<n; j++) {
		        var thisVert  = wVerts[j];
		        thisVert.x = this.vertices[i++];
		        thisVert.y = this.vertices[i++];
		        thisVert.z = this.vertices[i++];
		    }
			
			for (var i in this.states) {
				var state = this.states[i];
				
				if (state.on) {
					for (var y in state) {
						if (y != 'on') {
							var z = state[y];
							var selector = this.selectors[z.selector];
							var motion = this.motions[z.motion];
							var min = z.min;
							var max = z.max;
							var millis = z.millis;
							var repeat = z.repeat;
							var loopback = z.loopback;
							
							if (z.start) {} else {
								z.start = new Date().getTime();
								z.offset = z.start % millis;
								z.done = false;
							}
							var start = z.start;
							var offset = z.offset;
							var now = new Date().getTime();
							
							var l = repeat ? ((now + offset) % millis) / millis : (now - start) / millis;
							if (l > 1 && !repeat) { 
								l = 1; 
								z.done = true; 
							}
							
							if (loopback) {
								l = l*2;
								if (l>1) l = 1-(l-1);
							}
							
							l = ((max - min) * l) + min;

							if (motion.rotation) {
								var xx = ((motion.rotation[3] - motion.rotation[0]) * l) + motion.rotation[0];
								var yy = ((motion.rotation[4] - motion.rotation[1]) * l) + motion.rotation[1];
								var zz = ((motion.rotation[5] - motion.rotation[2]) * l) + motion.rotation[2];
								
								
								m1.makeRotationX( xx );
								m2.makeRotationY( yy );
								m3.makeRotationZ( zz );
								m.multiplyMatrices( m1, m2 );
								m.multiply( m3 );
							}
							n = selector.length;
							for (i=0; i<n; i++) {
								var wVert =  wVerts[selector[i]];
								if (motion.rotation) {
									var center = new THREE.Vector3(motion.rotation[6], motion.rotation[7], motion.rotation[8]);
									wVert.sub(center)
									wVert.applyMatrix4(m);
									wVert.add(center);
								}
								if (motion.translation) {
									var xx = ((motion.translation[3] - motion.translation[0]) * l);
									var yy = ((motion.translation[4] - motion.translation[1]) * l);
									var zz = ((motion.translation[5] - motion.translation[2]) * l);
									wVert.x += xx;
									wVert.y += yy;
									wVert.z += zz;
								}
							}
						}
					}
					mesh.geometry.verticesNeedUpdate = true;
//					mesh.geometry.computeFaceNormals();
//					mesh.geometry.computeVertexNormals();
				}
			}
		}
};

N3DENGINE.Model = function(meshname, color, imgname, cb) {
	this.buildMesh(meshname, color, imgname, cb);
};

N3DENGINE.Model.prototype = {
		
		constructor: N3DENGINE.Model,
		
		stepheight: 0.5,
		
		setState: function(name, val) {
			this.state.states[name].on = val;
		},

		collision: function(model, vector, near, far) {
/*			
			var MovingCube = this.cube;
			MovingCube.position.set(this.mesh.position);
			MovingCube.position.sub(this.min);
			MovingCube.position.x += this.size.x / 2;
			MovingCube.position.y += this.size.y / 2;
			MovingCube.position.z += this.size.z / 2;
			
			MovingCube.scale.set(this.mesh.scale);
			MovingCube.rotation.set(this.mesh.rotation);
			var originPoint = MovingCube.position.clone();
			
			for (var vertexIndex = 0; vertexIndex < MovingCube.geometry.vertices.length; vertexIndex++)
			{		
				var globalVertex = MovingCube.geometry.vertices[vertexIndex].clone();
				globalVertex.applyMatrix4(MovingCube.matrix);
				var directionVector = new THREE.Vector3(globalVertex)
				directionVector.sub( MovingCube.position );
				
				var ray = new THREE.Raycaster( originPoint, directionVector.clone().normalize(), 0, directionVector.length() );
				var collisionResults = ray.intersectObject(model.mesh);
				if ( collisionResults.length > 0 && collisionResults[0].distance < directionVector.length() ) 
					return true;
			}
*/			
			var min = this.min;
			var max = this.max;
			var pos = [ 
			    	this.mesh.position,
			    	new THREE.Vector3(min.x, min.y, min.z),
			    	new THREE.Vector3(min.x, min.y, max.z),
			    	new THREE.Vector3(min.x, max.y, min.z),
			    	new THREE.Vector3(min.x, max.y, max.z),
			    	new THREE.Vector3(max.x, min.y, min.z),
			    	new THREE.Vector3(max.x, min.y, max.z),
			    	new THREE.Vector3(max.x, max.y, min.z),
			    	new THREE.Vector3(max.x, max.y, max.z)
			];
			
			for (var n=0; n<pos.length; n++) {
				if (n>0) pos[n].applyMatrix4(this.mesh.matrix);
				var ray = new THREE.Raycaster( pos[n], vector, near, far );
				var intersects = ray.intersectObject(model.mesh);
				if (intersects.length > 0) return true;
			}			
			
/*			
			var localVertex = MovingCube.geometry.vertices[vertexIndex].clone();
			var globalVertex = MovingCube.matrix.multiplyVector3(localVertex);
			var directionVector = globalVertex.subSelf( MovingCube.position );
			
			var ray = new THREE.Ray( originPoint, directionVector.clone().normalize() );
			var collisionResults = ray.intersectObjects( collidableMeshList );
			if ( collisionResults.length > 0 && collisionResults[0].distance < directionVector.length() ) 
				appendText(" Hit ");
*/			
			
			return false;
		},
		
		moveTo: function(position, rotation, scale, millis, cb) {
			var mesh = this.mesh;
			var oposition = null;
			var orotation = null;
			var oscale = null;
			var ground = this.ground;
			
			if (position) oposition = new THREE.Vector3(mesh.position.x, mesh.position.y, mesh.position.z);
			if (rotation) orotation = new THREE.Vector3(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);
			if (scale) oscale = new THREE.Vector3(mesh.scale.x, mesh.scale.y, mesh.scale.z);
			
			var start = new Date().getTime();
			
			this.motion = function(model) {
				var mesh = model.mesh;
				var l = (new Date().getTime() - start) /  millis;
				if (l > 1) l = 1;
				
				if (position) {
					var dx = ((position.x - oposition.x) * l) + oposition.x;
					var dy =  ((position.y - oposition.y) * l) + oposition.y;
					var dz =  ((position.z - oposition.z) * l) + oposition.z;
					
/*					var ok = true;
					if (ground) { 
						var v = new THREE.Vector3(dx, dy, dz);
						var d = mesh.position.distanceTo(v);
						v.normalize();
						if (model.collision(ground, v, 0, d)) {
							v.multiplyScalar(d);
							v.y += model.stepheight;
							v.normalize();
							ok = !model.collision(ground, v, 0, d);
							if (ok) dy += model.stepheight;
						}
					}					
					
					if (ok) {
*/						mesh.position.x = dx;
						mesh.position.y = dy;
						mesh.position.z = dz;
						
//						if (ground) {
//							v.set(0, -1, 0);
//							while (model.collision(ground, v, 0, model.stepheight)) 
//								mesh.position.y += model.stepheight;
//						}

//					}
				}
				if (rotation) {
					mesh.rotation.x = ((rotation.x - orotation.x) * l) + orotation.x;
					mesh.rotation.y = ((rotation.y - orotation.y) * l) + orotation.y;
					mesh.rotation.z = ((rotation.z - orotation.z) * l) + orotation.z;
				}
				if (scale) {
					mesh.scale.x = ((scale.x - oscale.x) * l) + oscale.x;
					mesh.scale.y = ((scale.y - oscale.y) * l) + oscale.y;
					mesh.scale.z = ((scale.z - oscale.z) * l) + oscale.z;
				}
				
				if (l == 1) {
					model.motion = null;
					if (cb) cb(model);
				}
			};
		},
		
		addMesh: function(me, geometry, color, imgname, cb) {
				geometry.computeFaceNormals();
//				geometry.computeCentroids();
				geometry.computeVertexNormals();
				geometry.computeBoundingSphere();
				
				var material;
				if (color) material = new THREE.MeshPhongMaterial( { color: color });
				else material = new THREE.MeshPhongMaterial( {color:0xffffff, map: THREE.ImageUtils.loadTexture( botserver+imgname ) } );

				me.mesh = new THREE.Mesh( geometry, material);
				me.mesh.geometry.dynamic = true;
				me.mesh.model = me;
				
				if (cb) cb(me);
		},
		
		buildMesh: function(meshname, color, imgname, cb) {
			var me = this;
			if (typeof meshname == 'string') $.getJSON(botserver+meshname, function(data) {
				me.id = data.id;
				me.min = new THREE.Vector3(data.model.vertices[0].x, data.model.vertices[0].y, data.model.vertices[0].z);
				me.max = new THREE.Vector3(me.min.x, me.min.y, me.min.z);
				
				var min = me.min;
				var max = me.max;

				var model = data.model;
				var geometry = new THREE.Geometry();  
				var n = model.vertices.length;
				var i;
				for (i=0; i<n; i=i) {
					var x = model.vertices[i++];
					var y = model.vertices[i++];
					var z = model.vertices[i++];
					
					var v = new THREE.Vector3( x, y, z );
					geometry.vertices.push(v); 
					if (x < me.min.x) me.min.x = x;
					if (y < me.min.y) me.min.y = y;
					if (z < me.min.z) me.min.z = z;
					if (x > me.max.x) me.max.x = x;
					if (y > me.max.y) me.max.y = y;
					if (z > me.max.z) me.max.z = z;
				}
				me.size = new THREE.Vector3(max.x, max.y, max.z);
				me.size.sub(min);
				
				n = model.faces.length;
				for (i=0; i<n; i=i) {
					var x = model.faces[i++];
					var y = model.faces[i++];
					var z = model.faces[i++];
					geometry.faces.push( new THREE.Face3( x, y, z ) ); 
					geometry.faceVertexUvs[0].push( [ 
	  					new THREE.Vector2(model.map[x*2], model.map[(x*2)+1]),
						new THREE.Vector2(model.map[y*2], model.map[(y*2)+1]),
						new THREE.Vector2(model.map[z*2], model.map[(z*2)+1]),
					] );
				}
				
//				var cubeGeometry = new THREE.CubeGeometry(me.size.x, me.size.y, me.size.z,1,1,1);
//				var wireMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe:true } );
//				MovingCube = new THREE.Mesh( cubeGeometry, wireMaterial );
//				me.cube = MovingCube;
//				S.scene.add(this.cube);

				
				
				me.state = new N3DENGINE.ModelState(data);
				var b = true;
				for (var i in me.state.states) {
					b = false;
					break;
				}
				if (b) me.state = null;
				
				me.addMesh(me, geometry, color, imgname);
			});
			else {
//				me.id = "xxxxx";
//				me.min = new THREE.Vector3(0, 0, 0);
//				me.max = new THREE.Vector3(1, 1, 1);
				me.addMesh(me, meshname, color, imgname, cb);
			}
		}
};

N3DENGINE.Motions = new function() {
	
	this.circle = function(model){
		var obj = model.mesh;
		var r = 3;
		var l = ((new Date().getTime() % 5000) / 5000) * 2 * Math.PI;
		var x = Math.sin(l) * r;
		var y = Math.cos(l) * r;
	
		obj.position.x = x;
		obj.position.z = y;
		
		N3DENGINE.Motions.rotate(model);
	}
	
	this.rotate = function(model){
		model.mesh.rotation.y = ((new Date().getTime() % 5000) / 5000) * 2 * Math.PI;
	}
	
	this.undulate = function(model){
		var obj = model.mesh;
		if (obj.spinminy) {} else {
			obj.spinminy = 100;
			obj.spinmaxy = -100;
			obj.spinperiod = 1000;
			obj.numundulations = 5;
		}
		var r = 0.5;
		var l = ((new Date().getTime() % obj.spinperiod) / obj.spinperiod) * 2 * Math.PI;
	
		var wVerts = obj.geometry.vertices;
	    var n = wVerts.length;
	    while(n--) {
	        var thisVert  = wVerts[n];
	
	        if (thisVert.originalPosition) {
	        	
	        	var m = (thisVert.y - obj.spinminy) / (obj.spinmaxy - obj.spinminy) * Math.PI * obj.numundulations;
	        	var x = Math.sin(l+m) * r;
	        	
	        	thisVert.x = thisVert.originalPosition.x + x;
	        }
	        else {
	        	thisVert.originalPosition = new Object();
	        	thisVert.originalPosition.x = thisVert.x;
	        	thisVert.originalPosition.y = thisVert.y;
	        	thisVert.originalPosition.z = thisVert.z;
	        	
	        	if (thisVert.y < obj.spinminy) obj.spinminy = thisVert.y;
	        	if (thisVert.y > obj.spinmaxy) obj.spinmaxy = thisVert.y;
	        }
	    }
	
		obj.geometry.verticesNeedUpdate = true;
	}
	
	return this;
}
