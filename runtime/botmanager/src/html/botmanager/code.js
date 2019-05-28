var N3DCODE = N3DCODE || { VERSION: '1' };

N3DCODE.render = function(divid, CODE){
	CODE.execute = function(){
	  var o = stripCons(CODE);
	  json('write', 'db=code&id=src&data='+encodeURIComponent(JSON.stringify(o)), function(result){
		var args = {};
		for (var i in o.input.out) {
		  args[i] = $('#'+exid+'_'+i).val();
		}
		json('execute', 'db=code&id=src&args='+encodeURIComponent(JSON.stringify(args)), function(result){
		  $('#'+resid).text(JSON.stringify(result));
		});
	  });
	}
	
	CODE.deleteSelected = function(){
	  $('#'+divid+'_cmd').css('display', 'none');
	  scene.removeModel(SELECTED.model);
	  scene.removeModel(SELECTED.text);
//	  for (var i in SELECTED.in)  { SELECTED.in[i].disconnect(); scene.removeModel(SELECTED.in[i].model); }
//	  for (var i in SELECTED.out)  { SELECTED.out[i].disconnect(); scene.removeModel(SELECTED.out[i].model); }
  	  setNodes(SELECTED, {}, {})
	  SELECTED.type = 'undefined';
	  SELECTED.name = '';
	  SELECTED = null;
	}
	
	CODE.saveSelected = function(){
	  $('#'+divid+'_cmd').css('display', 'none');
	  scene.removeModel(SELECTED.text);
	  var name = $('#'+divid+'_cmd_name').val();
	  SELECTED.name = name;
	  var type = $('#'+divid+'_cmd_type').val();
	  SELECTED.type = type;
	  var geo = buildTextGeo(name);
	  SELECTED.text = new N3DENGINE.Model(geo, 0x333333, null, function(model){ 
		  scene.addModel(model); 
		  var p = SELECTED.pos;
		  var m = model.mesh;
		  var d = m.geometry.boundingSphere.radius*2.5;
		  m.position.set(p.x-d, p.y-10, p.z+10);
		  m.scale.set(2.5,2.5,2.5);
	  });
	  
	  if (type=='primitive'){
		  var prim = $('#'+divid+'_cmd_primlist')[0].data[name];
		  var nin = prim.in;
		  var nout = prim.out;
		  
		  setNodes(SELECTED, nin, nout);
	  }
	  else if (type=='constant') {
	    setNodes(SELECTED, {}, {a:{}});
	    SELECTED.ctype = $('#'+divid+'_cmd_ctype').val();
	  }
	  else if (type=='peer') {
	    var cmd = $('#'+divid+'_cmd_botcmds')[0].data.commands[name];
	    var nodes = {};
	    for (var i in cmd.parameters) nodes[cmd.parameters[i]] = {};
	    setNodes(SELECTED, nodes, {result:{}});
	    SELECTED.btype = $('#'+divid+'_cmd_bots').val();
	  }
	}
	
	CODE.showCmdTypeInfo = function(){
	  var val = $('#'+divid+'_cmd_type').val();
	  
	  if ((val == 'primitive') || (val == 'peer')) {
		$('#'+divid+'_cmd_name').css('display', 'none');
	  }
	  else {
		$('#'+divid+'_cmd_name').css('display', 'inline-block');
	  }
	  
	  if (val == 'primitive') {
		$('#'+divid+'_cmd_primlist').css('display',  'inline-block');
		$('#'+divid+'_cmd_primlist').val(SELECTED.name);
		$('#'+divid+'_cmd_name').val($('#'+divid+'_cmd_primlist').val());
	  }
	  else {
		$('#'+divid+'_cmd_primlist').css('display',  'none');
	  }
	  
	  if (val == 'constant'){
	    $('#'+divid+'_cmd_ctype').val(SELECTED.ctype);
	    $('#'+divid+'_cmd_ctype').css('display', 'inline-block');
	  }
	  else {
	    $('#'+divid+'_cmd_ctype').css('display', 'none');
	  }
	  
	  if (val == 'peer') {
	    $('#'+divid+'_cmd_bots').val(SELECTED.btype);
	    $('#'+divid+'_cmd_bots').css('display', 'inline-block');
	    $('#'+divid+'_cmd_bots').change();
	    $('#'+divid+'_cmd_botcmds').css('display', 'inline-block');
		$('#'+divid+'_cmd_botcmds').val(SELECTED.name);
		$('#'+divid+'_cmd_name').val($('#'+divid+'_cmd_botcmds').val());
	  }
	  else {
	    $('#'+divid+'_cmd_bots').css('display', 'none');
	    $('#'+divid+'_cmd_botcmds').css('display', 'none');
	  }
	}
	
	CODE.populateBotCmds = function(botname){
	  var data = $('#'+divid+'_cmd_bots')[0].data[botname];
	  var cmds = data.commands;
	  var newhtml = '';
	  for (var i in cmds){
		  newhtml += '<option value="'+i+'">'+i+'<'+'/option>';
	  }
	  $('#'+divid+'_cmd_botcmds').html(newhtml)[0].data = data;
	  $('#'+divid+'_cmd_botcmds').change();
	}
	
	function cmdIndex(cmd) {
	  if (cmd.type == 'outputbar') return -2;
	  if (cmd.type == 'inputbar') return -1;
	  var i = CODE.cmds.indexOf(cmd);
	  if (i == -1) return -3;
	  return i;
	}
	
	function setNodes(cmd, nin, nout){
	  for (var i in cmd.in) if (!nin[i]) {
		  var node = cmd.in[i];
		  scene.removeModel(node.model);
		  scene.scene.remove(node.line);
		  delete cmd.in[i];
		  var j = CODE.cons.length;
		  while (j-->0) if (CODE.cons[j].dest[0] == cmdIndex(cmd) && CODE.cons[j].dest[1] == i) 
			CODE.cons.splice(j,1);
	  }
	  for (var i in nin) if (!cmd.in[i]) 
		cmd.in[i] = {}; 
	  
	  for (var i in cmd.out) if (!nout[i]) {
		  var node = cmd.out[i];
		  scene.removeModel(node.model);
		  scene.scene.remove(node.line);
		  delete cmd.out[i];
		  var j = CODE.cons.length;
		  while (j-->0) if (CODE.cons[j].src[0] == cmdIndex(cmd) && CODE.cons[j].src[1] == i) 
			CODE.cons.splice(j,1);
	  }
	  for (var i in nout) if (!cmd.out[i]) 
		cmd.out[i] = {}; 
	  
	  addNodes(cmd, 'in');
	  addNodes(cmd, 'out');
	}
	
	function stripCons(o){
	  if (o.type == 'undefined') return { type: 'undefined', in: {}, out: {} };
	  var n = {};
	  for (var key in o) {
	    if (key == 'cmds') { n.cmds = []; for (var i in o.cmds) n.cmds[i] = stripCons(o.cmds[i]); }
	    else if (key == 'cons') { n.cons = []; for (var i in o.cons) n.cons[i] = stripCons(o.cons[i]); }
		else if (key == 'in') { n.in = {}; for (var i in o.in) n.in[i] = stripCons(o.in[i]); }
		else if (key == 'out') { n.out = {}; for (var i in o.out) n.out[i] = stripCons(o.out[i]); }
		else if (key == 'input') n.input = stripCons(o.input);
		else if (key == 'output') n.output = stripCons(o.output); 
		else if (key != 'con' && key != 'model' && key != 'text' && key != 'parent' && key != 'line') n[key] = o[key];
	  }
	  
	  return n;
	}
	
	function buildTextGeo(text){
		var height = 2,
			size = 7,
			hover = 3,

			curveSegments = 4,

			bevelThickness = 0.2,
			bevelSize = 0.15,
			bevelSegments = 3,
			bevelEnabled = true,

			font = "optimer", // helvetiker, optimer, gentilis, droid sans, droid serif
			weight = "bold", // normal bold
			style = "normal"; // normal italic

		var textGeo = new THREE.TextGeometry( text, {
			size: size,
			height: height,
			curveSegments: curveSegments,
		
			font: font,
			weight: weight,
			style: style,
		
			bevelThickness: bevelThickness,
			bevelSize: bevelSize,
			bevelEnabled: bevelEnabled,
		
			material: 0,
			extrudeMaterial: 1
		});
		return textGeo;
	}
	
	function addNodes(data, which){
		var n = 0;
		for (var i in data[which]) n++;

		var j = 0;
		for (var i in data[which]) {
			var node = data[which][i];
			if (node == data) alert(99);
			node.parent = data;
			node.which = which;
			if (!data[which][i].model) data[which][i].model = addNode(node, j, n, which, i);
			j++;
		}
	}
	
	function addNode(data, x, n, which, name){
		data.name = name;
		var nodegeo = new THREE.SphereGeometry( 5, 32, 32 );
		var nodecolor = which == 'out' ? '#0000ff' : '#00ff00';
		return new N3DENGINE.Model(nodegeo, nodecolor, null, function(model){
			model.id = data.parent.id+'_'+which+'_'+x;
			model.data = data;
			var p = data.parent.pos;
			model.mesh.position.set(p.x, p.y, p.z);
			model.mesh.scale.set(0.025, 0.025, 0.025);
			scene.addModel(model);

			var z = which == 'out' ? -1 : 1;
			var w = data.parent.width *3;
			var position = data.pos ? data.pos : new THREE.Vector3(p.x-w/2 + x*w/n + w/(2*n),p.y+(z*NODEHEIGHT),0);
			var rotation = data.rot ? data.rot : new THREE.Vector3(0, Math.PI*2, 0);
			var scale = data.scal ? data.scale : new THREE.Vector3(2.5,2.5,2.5);
			
			data.pos = position;
			data.rot = rotation;
			data.scale = scale;
			data.delta = position.x - p.x;
			
			data.update = function(x,y,z){
				var nx = x + data.delta;
				var ny = y + ((data.which == 'out' ? -1 : 1)*NODEHEIGHT);
				data.pos.x = nx;
				data.pos.y = ny;
				var mesh = data.model.mesh;
				mesh.position.x = nx;
				mesh.position.y = ny;
				
				if (data.line) {
				  var geo = data.line.geometry;
				  geo.vertices[data.which == 'out' ? 0 : 1] = data.pos;
				  geo.verticesNeedUpdate = true;
				}
				
				data.text.mesh.position.set(nx+20, ny-(data.which=='out' ? 20 : 0), 0);
			}
			
			data.select = function(){
				if (SELECTED != null) SELECTED.unselect();
				SELECTED = data;
				model.moveTo(
					position, 
					rotation, 
					new THREE.Vector3(3.5,3.5,3.5), 
					ANIMILLIS/3, 
					function(){}
				);
				data.text.moveTo(
					data.text.position, 
					data.text.rotation, 
					new THREE.Vector3(2.5,2.5,2.5), 
					ANIMILLIS/3, 
					function(){}
				);
			}
			
			data.unselect = function(){
				SELECTED = null;
				model.moveTo(
					position, 
					rotation, 
					new THREE.Vector3(2.5,2.5,2.5), 
					ANIMILLIS/3, 
					function(){}
				);
				data.text.moveTo(
					data.text.position, 
					data.text.rotation, 
					new THREE.Vector3(0.1,0.1,0.1), 
					ANIMILLIS/3, 
					function(){}
				);
			}
			
			data.drawCon = function(){
				var con = data.con;
				var i = con.src[0];
				var data1 = i == -1 ? CODE.input : CODE.cmds[i];
				if (data1.out[con.src[1]].model) {
					var node1 = data1.out[con.src[1]];
					var pos1 = node1.model.mesh.position;
					i = con.dest[0];
					if (i == -1) alert('ERROR: i = con.dest[0] = -2');
					var data2 = i == -2 ? CODE.output : CODE.cmds[i];
					var node2 = data2.in[con.dest[1]];
					var pos2 = node2.model.mesh.position;
					
					var l = pos1.distanceTo(pos2);
					
					var material = new THREE.LineBasicMaterial({
						color: 0xff0000
					});
					
					var geometry = new THREE.Geometry();
					geometry.vertices.push(
						pos1,
						pos2
					);
					
					var line = new THREE.Line( geometry, material );
					scene.scene.add( line );
					
					con.line = line;
					node1.line = line;
					node2.line = line;
				}			
			};
			
			data.disconnect = function(){
			  scene.scene.remove(data.line);
			  var pos = cmdIndex(data.parent);
			  var j = CODE.cons.length;
			  while (j-->0) {
			    var con = CODE.cons[j];
			  	if ((con.src[0] == pos && con.src[1] == data.name) || (con.dest[0] == pos && con.dest[1] == data.name)) 
			  		CODE.cons.splice(j,1);
			  }
			}
			
			data.connect = function(node2){
			  if (SELECTED == this) data.disconnect();
			  else {
			  	if (SELECTED.which != this.which) {
			  	  var n1 = this.which == 'in' ? SELECTED : this;
			  	  var n2 = this.which == 'in' ? this : SELECTED;
			  	  n2.disconnect();
			  	  var con = { src: [cmdIndex(n1.parent), n1.name], dest: [cmdIndex(n2.parent), n2.name] };
			  	  CODE.cons.push(con);
			  	  n2.con = con;
			  	  n2.drawCon();
			  	}
			  }
			}
			
			model.moveTo(position, rotation, scale, ANIMILLIS, function(model){
				model.click = function(event){
					if (SELECTED && event.metaKey) data.connect();
					else data.select();
				};
				
				model.drag = function(event){
					var d = model.data;
					var cw = d.parent.width;
					var x = event.offsetX - W/2;
					var y = d.parent.pos.y;
					d.delta = x - d.parent.pos.x;
					if (Math.abs(d.delta)*2 <= cw) d.update(x,y,d.pos.z);
				};
				
				if (data.con && !data.line) data.drawCon();
				
				function setName(name){
					data.name = name;
					var textgeo = buildTextGeo(name);
					data.text = new N3DENGINE.Model(textgeo, 0x777777, null, function(model){ 
						scene.addModel(model); 
						var p = data.pos;
						var m = model.mesh;
	//					var d = m.geometry.boundingSphere.radius*2.5;
						m.position.set(p.x+20, p.y-(data.which=='out' ? 20 : 0), p.z);
						m.scale.set(0.1,0.1,0.1);
	
						model.click = function(e){
						  var x = window.prompt("Name this node", name);
						  if(x != null) {
						    scene.removeModel(model);
						    delete data.parent[data.which][data.name];
						    data.parent[data.which][x] = data;
						    if (data.con){
						      var bar = data.which == 'in' ? 'dest' : 'src';
						      data.con[bar][1] = x;
						    }
						    setName(x);
						    setTimeout(function(){
						      data.model.click({});
						    }, 500);
						  }
						}
					});
				}
				setName(name);
			});
		});
	}
		
	function addCmd(data, cb){
		var geo;
		var color;

		geo = new THREE.BoxGeometry( data.width, 10, 10 );
		color = data.color;
		
		data.select = function(){
			if (SELECTED) SELECTED.unselect();
			SELECTED = data;
			data.model.mesh.material.color.setHex( 0x777777 );
			if (data.name != 'inputbar' && data.name != 'outputbar'){
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
			
				$('#'+divid+'_cmd').css('top', H/2 - data.pos.y + 30);
				$('#'+divid+'_cmd_name').val(data.name);
				$('#'+divid+'_cmd_type').val(data.type);
				$('#'+divid+'_cmd').css('display', 'block');
				CODE.showCmdTypeInfo();
			}
			else $('#'+divid+'_cmd').css('display', 'none');
		}
		
		data.unselect = function(){
			SELECTED = null;
			data.model.mesh.material.color.setHex( 0xcccccc );
			$('#'+divid+'_cmd').css('display', 'none');
		}
		
		data.keyup = function(e){
//		  if (e.keyCode == 8) CODE.deleteSelected();
		}
		
		return new N3DENGINE.Model(geo, color, null, function(model){
			model.id = data.id;
			model.mesh.scale.set(0.025, 0.025, 0.025);
			scene.addModel(model);
			model.moveTo(data.pos, data.rot, SCALE, ANIMILLIS, function(model){
				model.click = data.select;
				model.drag = function(event){
					var x = event.offsetX - W/2;
					var y = H/2 - event.offsetY;
					model.mesh.position.x = x;
					model.mesh.position.y = y;
					
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

					var p = data.pos;
					p.x = x;
					p.y = y;
					
					if (data.text){
						var d = data.text.mesh.geometry.boundingSphere.radius*2.5;
						data.text.mesh.position.set(p.x-d, p.y-10, p.z+10);
					}
					for (var i in data.in) data.in[i].update(x, y, p.z);
					for (var i in data.out) data.out[i].update(x, y, p.z);
				};
			});

			setTimeout(function(){
				if (data.id != 'inputbar' && data.id != 'outputbar') {
					var textgeo = buildTextGeo(data.name);
					data.text = new N3DENGINE.Model(textgeo, 0x333333, null, function(model){ 
						scene.addModel(model); 
						var p = data.pos;
						var m = model.mesh;
						var d = m.geometry.boundingSphere.radius*2.5;
						m.position.set(p.x-d, p.y-10, p.z+10);
						m.scale.set(2.5,2.5,2.5);
					});
					data.text.click = data.model.click
					data.text.drag = data.model.drag
				}
				if (data.in) addNodes(data, "in");			
				if (data.out) addNodes(data, "out");			
				if (cb) cb(model);
			}, ANIMILLIS);
		});
	}
	
	var scene = new N3DENGINE.Scene('#'+divid);

    var exid = divid+"_ex"
    var resid = divid+"_res"
	$('#'+divid).append("<div id='"+divid+"_ex'></div>");
	$('#'+exid)[0].CODE = CODE;

	$('#'+divid).append("<button onclick='$("+divid+"_ex)[0].CODE.execute();'>execute</button>");
	$('#'+divid).append("<div id='"+divid+"_res'></div>");
	$('#'+divid).parent().append("<div id='"+divid+"_cmd' style='width: 600px; background-color:#333; color: white; padding:20px; line-height:30px; position:absolute; display:none;'><button onclick='$(\"#"+divid+"_ex\")[0].CODE.deleteSelected();' style='position:absolute;right:10px;'>delete</button>Type: <select id='"+divid+"_cmd_type' onchange='$(\"#"+divid+"_ex\")[0].CODE.showCmdTypeInfo();'><option value='local'>local</option><option value='primitive'>primitive</option><option value='constant'>constant</option><option value='peer'>bot</option></select><select id='"+divid+"_cmd_ctype'><option value='int'>int</option><option value='decimal'>decimal</option><option value='boolean'>boolean</option><option value='string'>string</option><option value='array'>object</option><option value='array'>array</option></select><select id='"+divid+"_cmd_bots' style='display:none;' onchange='$(\"#"+divid+"_ex\")[0].CODE.populateBotCmds($(this).val());'></select><br>Name: <input type='text' id='"+divid+"_cmd_name'><select id='"+divid+"_cmd_primlist' style='display:none;' onchange='$(\"#"+divid+"_cmd_name\").val($(this).val());'></select><select id='"+divid+"_cmd_botcmds' style='display:none;' onchange='$(\"#"+divid+"_cmd_name\").val($(this).val());'></select><br><br><br><button onclick='$(\"#"+divid+"_ex\")[0].CODE.saveSelected();'>save</button></div>");
	
	var SELECTED = null;
	window.addEventListener( "keyup", function(event){ if (SELECTED != null && SELECTED.keyup) SELECTED.keyup(event); }, true);

	var W = $('#'+divid).width();
	var H = $('#'+divid).height();
	var NODEHEIGHT = 20;
	var SCALE = new THREE.Vector3(2.5,2.5,2.5);
	var ANIMILLIS = 500;
	
	if (!CODE.input) CODE.input = {
		id: 'inputbar',
		name: 'inputbar',
		type: 'inputbar',
		pos: new THREE.Vector3(0,H/2,0),
		rot: new THREE.Vector3(0, Math.PI*2, 0),
		width: W/3,
		color: '#00ff00',
		out: {}
	}
	$('#'+exid).html('');
	for (var i=0;i<CODE.cons.length;i++) if (CODE.cons[i].src[0] == -1) {
	  var con = CODE.cons[i];
	  if (!CODE.input.out[con.src[1]]) CODE.input.out[con.src[1]] = { con: con };
//	  if (!$('#'+exid+'_'+con.src[1])) 
	    $('#'+exid).append(con.src[1]+': <input type="text" id="'+exid+'_'+con.src[1]+'"><br>');
	}
	CODE.input.model = addCmd(CODE.input, function(model){});	

	if (!CODE.output) CODE.output = {
		id: 'outputbar',
		name: 'outputbar',
		type: 'outputbar',
		pos: new THREE.Vector3(0,-H/2,0),
		rot: new THREE.Vector3(0, Math.PI*2, 0),
		width: W/3,
		color: '#0000ff',
		in: {}
	}
	for (var i=0;i<CODE.cons.length;i++) if (CODE.cons[i].dest[0] == -2) {
	  var con = CODE.cons[i];
	  if (!CODE.output.in[CODE.cons[i].dest[1]]) CODE.output.in[CODE.cons[i].dest[1]] = { con: con };
	}
	CODE.output.model = addCmd(CODE.output, function(model){});	
	
	var n = CODE.cmds.length;
	for (var x=0;x<n;x++){
		var cmd = CODE.cmds[x];
		if (cmd.type != 'undefined'){
		  if (!cmd.pos) {
			cmd.pos = new THREE.Vector3(W/-2 + (x+1)*(W/(n+1)),H/2 - (x+1)*(H/(n+1)),0);
			cmd.rot = new THREE.Vector3(0, Math.PI*2, 0);
			cmd.width = 50,
			cmd.color = '#ccc';
		  }
		  cmd.model = addCmd(cmd, function(model){
		  });
		}
	}
	
	for (var i=0;i<CODE.cons.length;i++) {
		var con = CODE.cons[i];
		var src = con.src[0];
		var dest = con.dest[0];
		
		var a = con.src[1];
		var node1 = src == -1 ? CODE.input.out[a] : CODE.cmds[src].out[a];
		node1.con = con;
		
		var b = con.dest[1];
		var node2 = dest == -2 ? CODE.output.in[b] : CODE.cmds[dest].in[b];
		node2.con = con;
	}
	
	json('primitives', null, function(result){
	  var newhtml = '';
	  for (var i in result){
	    newhtml += '<option value="'+i+'">'+i+'<'+'/option>';
	  }
	  $('#'+divid+'_cmd_primlist').html(newhtml)[0].data = result;
	  
	  json('../securitybot/listapps', null, function(result){
		var newhtml = '';
		for (var i in result.data){
		  newhtml += '<option value="'+i+'">'+i+'<'+'/option>';
		}
		$('#'+divid+'_cmd_bots').html(newhtml)[0].data = result.data;
		$('#'+divid+'_cmd_bots').change();
	  });
	});
	
	scene.click = function(event){
		if (SELECTED) SELECTED.unselect();
		if (event.metaKey) {
		    var cmd = null;
		    for (var i in CODE.cmds) if (CODE.cmds[i].type == 'undefined') { cmd = CODE.cmds[i]; break; }
			if (cmd == null) {
				cmd = {
					name:'',
					in: {},
					out: {},
					type:'local',
				};
				CODE.cmds.push(cmd);
			}
			
			var x = event.offsetX - W/2;
			var y = H/2 - event.offsetY;
			cmd.pos = new THREE.Vector3(x, y, 0);
			cmd.rot = new THREE.Vector3(0, Math.PI*2, 0);
			cmd.width = 50,
			cmd.color = '#ccc';
			cmd.model = addCmd(cmd, function(model){ cmd.select(); });
		}
	}
};