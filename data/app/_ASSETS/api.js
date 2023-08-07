var CACHEMILLIS = 5000;
var CTLCACHE = {};
var DATACACHE = {};
var alljsapis = {};
var allmetas = {};
var CMDS = {};
var SOCK = null;    

function guid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	  var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
	  return v.toString(16);
  });
}

function D$(lib, ctl, name, cb){
  lookupID(lib, ctl, function(id){
    if (id) {
      ctl = getByProperty(CTLCACHE[lib].list, 'id', id);
      if (ctl) {
        if (ctl.data) {
          var data = getByProperty(ctl.data.data, "name", name);
          if (!data) cb(null);
          else {
            json('read', 'lib='+encodeURIComponent(lib)+'&id='+encodeURIComponent(data.id), function(result){
              if (result.status != 'ok') cb(null);
              else cb(result.data);
			});
		  }
		}
        else {
          json('read', 'lib='+encodeURIComponent(lib)+'&id='+encodeURIComponent(id), function(result){
            if (result.status != 'ok') cb(null);
            else {
              ctl.data = result.data;
              D$(lib, id, name, cb);
			}
          });
        }
	  }
	  else cb(null);
    }
  });
}

function lookupID(lib, name, cb){

  var now = new Date().getTime();

  var x = CTLCACHE[lib];
  if (!x) x = CTLCACHE[lib] = { when: 0, waiting: {} };
  if (now - x.when > CACHEMILLIS) {
    if (x.fetching) setTimeout(function(){ lookupID(lib, name, cb) }, 100);
    else {
      x.fetching = true;
	  json('../app/read', 'lib='+encodeURIComponent(lib)+'&id=controls', function(result){
		if (result.status != 'ok') cb(name);
		else {
		  x.when = now;
		  x.fetching = false;
		  x.list = result.data.list;
		  lookupID(lib, name, cb);
		}
	  });
	}
  }
  else {
    var y = getByProperty(x.list, 'name', name);
    cb(y ? y.id : name);
  }
}

function fetchNextData(lib, data, whendone){
  if (DATACACHE[lib] && DATACACHE[lib][data.id] && DATACACHE[lib][data.id].data) whendone(JSON.parse(JSON.stringify(DATACACHE[lib][data.id].data)));
  else{
    if (!DATACACHE[lib]) DATACACHE[lib] = {};
    if (DATACACHE[lib][data.id]){
      DATACACHE[lib][data.id].list.push({lib:lib, data:data, xxx:whendone});
    }    
    else{
	  DATACACHE[lib][data.id] = { list:[] };
	  
	  json('../app/read', 'lib='+lib+'&id='+data.id, function(result){
		DATACACHE[lib][data.id].data = result;
	  
		for (var i in DATACACHE[lib][data.id].list){
		  DATACACHE[lib][data.id].list[i].xxx(JSON.parse(JSON.stringify(result)));
		}
	  
		whendone(result);
	  });
    }
  }
}

function handlenextdata(el, dat, lib, finish){
  if (dat.length == 0) finish();
  else {
	var data = dat.shift();
	fetchNextData(lib, data, function(result){
	  $(el).data(data.name, result.data);
	  handlenextdata(el, dat, lib, finish);
	});
  }		  
}

function build(el, apijs, html, css, js){
	var newhtml = '<'+'style scoped>'+css+'<'+'/style>';
	newhtml += html;
	newhtml += '<'+'script>$("#'+$(el)[0].id+'")[0].api = new function() { this.UUID = "'+$(el)[0].id+'";\n'+apijs+'\n'+js+'\n };<'+'/script>';
	return newhtml;
}

function getjsapi(lib, id, cb){
  if (alljsapis[lib] && alljsapis[lib][id]) 
	if (Array.isArray(alljsapis[lib][id])) alljsapis[lib][id].push(cb);
	else cb(lib, id, alljsapis[lib][id]);
  else {
	if (!alljsapis[lib]) alljsapis[lib] = {};
	if (!alljsapis[lib][id]) alljsapis[lib][id] = [cb];
	send_buildjsapi(lib, id, function(result){
	  var n = alljsapis[lib][id].length;
	  for (var i=0;i<n;i++) alljsapis[lib][id][i](lib, id, result);
	  alljsapis[lib][id] = result;
	});
  }
}
    
function installControl(el, lib, id, cb, data) {
  var oldhtml = $(el).children();
  
  if (!data){
    var d2 = $(el).data('control');
    if (!d2) {
      data = { lib:lib, id:id };
      $(el).data('control', data);
	}
	else data = d2;
  }
  else $(el).data('control', data);
  $(el)[0].ctl = data;

  if (!data) data = { lib:lib, id:id };
  if (!$(el).data('control')) $(el).data('control', data);
  $(el)[0].DATA = data;

  lookupID(lib, id, function(id2){
	if (id2 != null) id = id2;
    
	function handlejsapi(lib, id, result){
	  console.log("JSAPI "+lib+"/"+id+": "+JSON.stringify(result));
	  var apijs = result.data ? result.data.js : '';
	  
	  function getctlmeta(lib, id, cb){
	    if (allmetas[lib] && allmetas[lib][id]) {
	      if (Array.isArray(allmetas[lib][id])) allmetas[lib][id].push(cb);
	      else cb(lib, id, allmetas[lib][id]);
		}
		else {
		  if (!allmetas[lib]) allmetas[lib] = {};
		  if (!allmetas[lib][id]) allmetas[lib][id] = [cb];
		  json('../app/read', 'lib='+encodeURIComponent(lib)+'&id='+encodeURIComponent(id), function(result){
			var n = allmetas[lib][id].length;
			for (var i=0;i<n;i++) allmetas[lib][id][i](lib, id, Object.assign({}, result));
			allmetas[lib][id] = result;
		  });
		}	  
	  }

	  function handlectlmeta(lib, id, result){
	    $(el)[0].meta = result.data;
		if (!$(el)[0].id) $(el)[0].id = guid();

		if (cb){
		  $(el)[0].cb = cb;
		}
		
		var html = result.data ? result.data.html : '';
		var css = result.data ? result.data.css : '';
		var js = result.data ? result.data.js : '';
		var dat = result.data ? result.data.data : [];
		
		var newhtml = build(el, apijs, html, css, js);
		
		var finish = buildFinish(el, newhtml, oldhtml, cb);
		if (dat != null && dat.length>0) handlenextdata(el, dat.slice(), lib, finish)
		else finish();
	  }
	  getctlmeta(lib, id, handlectlmeta);
	}

	getjsapi(lib, id, handlejsapi);
  });
}

function buildFinish(el, newhtml, oldhtml, cb){
  function finish(){
	$(el).empty();
	try { 
	  $(el).html(newhtml).trigger('create'); 
	} 
	catch (x) { 
	  debugger;
	  console.log(x); 
	  console.log(newhtml); 
	}
	
  //		  if (componentHandler) componentHandler.upgradeElements($(el)[0]);
	activateControls(el, function(api){
	  if (api){
		api.oldhtml = oldhtml;
		if (cb) cb(api);
	  }
	});
  }
  return finish;
}

function activateControl(el, cb){
  var c = $(el).data('control');
  if (c.lib){
    if (c.require_groups) {
      json('../security/current_user', null, function(result){
        for (group in c.require_groups) {
          if (result.data.groups.indexOf(c.require_groups[group]) == -1) {
            window.location.href='../app/login.html';
          }
        }
      });
    }
	installControl(el, c.lib, c.id, cb);
  }
  else {
    var i = c.indexOf(':');
    var j = c.indexOf(':', i+1);
    var data = j != -1 ? c.substring(j+1) : null;
	var sa = c.split(":");
	data = sa.length<3 ? null : sa[2][0] == '{' || sa[2][0] == '[' ? JSON.parse(data) : data;
	installControl(el, sa[0], sa[1], cb, data);
  }
}

function activateControls(element, cb){
  var all = [];
  var done = [];
  
  function finish(){
	setTimeout(function(){
	  if (cb) cb($(element)[0].api);
	  if ($(element)[0].api && $(element)[0].api.ready) $(element)[0].api.ready(element);
	},0);
  }
    
  $(element).find('.data-control').each(function(i, el){
    try
    {
	  console.log("FOUND: "+el);
	  all.push(el);
	  activateControl(el, function(api){
	    done.push(true);
//	    alert(element+"/"+all.length+"/"+done.length);
	    if (done.length == all.length) finish();
	  });
	}
	catch (x) { alert(x); }
  });
  
  if (all.length == 0) finish();
}

function send_buildjsapi(lib, id, cb){
  $.ajax({
	  url: "../app/jsapi/js/"+encodeURIComponent(lib)+"/"+encodeURIComponent(id)+".js", 
	  type: 'get',
	  error: function(XMLHttpRequest, textStatus, errorThrown){
		  console.log('status:' + XMLHttpRequest.status + ', status text: ' + XMLHttpRequest.statusText);
		  var result = {};
		  result.data = {};
		  result.data.js = '';
		  cb(result);
	  },
	  success: function(js){
		if (js.status) cb(js);
		else {
		  var result = {};
		  result.data = {};
		  result.data.js = js;
		  cb(result);
		}
	  }
  });  
}

function msg(m, color, div){
  if (!div) div = 'msgdiv';
  $('#'+div).css('color', color);
  $('#'+div).html(m);
}

function error(m, div){
  msg('ERROR: '+m, 'red', div);
}

function info(m, div){
  msg(m, '#333', div);
}

function getByProperty(array, id, val){
  if(array){
	var i = array.length;
	while (i-->0) if (array[i][id] == val) return array[i];
  }
  return null;
}

var lettersandnumberonly ='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

function lettersAndNumbersOnly(s) 
{
    var out = "";
    var i = s.length;
    while (i-->0)
    {
        var ss = s.substring(i,i+1);
        if (lettersandnumberonly.indexOf(ss) != -1)
        {
            out = ss+out;
        }
    }	
    
    return out;
}

function startWebSocket(){
  if (!SOCK) {
	var url = document.URL;
	url = url.substring(4);
	var ii = url.indexOf('#');
	if (ii != -1) url = url.substring(0,ii);
	url = 'ws'+url;
	var connection = new WebSocket(url, ['newbound']);
	document.nbws_connecting = true;
	console.log("Opening websocket");
	
	connection.onopen = function(){
		SOCK = connection;
		document.nbws_connecting = false;
	};
	
	connection.onerror = function(error){
		SOCK = null;
		document.nbws_connecting = false;
		console.log('Websocket error:');
		console.log(error);
		
		var o = { "status": "err", "msg": "Websocket error", "error": error };
		for (var i in CMDS) CMDS[i](o);
	};
	
	connection.onclose = function(error){
		SOCK = null;
		document.nbws_connecting = false;
		console.log('Websocket close:');
		console.log(error);
		
		var o = { "status": "err", "msg": "Websocket closed", "error": error };
		for (var i in CMDS) CMDS[i](o);
	};
	
	connection.onmessage = function(e){
//	  debugger;
//      console.log("INCOMING WEBSOCKET MESSAGE: ");
//      console.log(e);
	  var o = JSON.parse(e.data);
	  var pid = o.pid;
	  var div = o.guid ? $('#'+o.guid)[0] : null;
	  if (CMDS[pid]) {
		var cb = CMDS[pid];
		if (cb) {
		  delete CMDS[pid];
		  cb(o);
		}
	  }
	  else if (o.app && o.event && SUBSCRIPTIONS[o.app] && SUBSCRIPTIONS[o.app][o.event]) 
	    for (var i in SUBSCRIPTIONS[o.app][o.event]) 
	      SUBSCRIPTIONS[o.app][o.event][i](o.data);
	  else if (div && div.api && div.api.wscb) div.api.wscb(o);
	  else if (typeof WSCB != 'undefined') WSCB(o);
	  else console.log("Received unexpected websocket data: "+e.data);
	};
  }
}
//FIXME - Doesn't work without websocket or for local tempfiles
function tempfile(peer, stream, cb){
  	var pid = guid();
  	CMDS[pid] = cb;

	var wrap = {
	  "pid": pid,
	  "peer": peer,
	  "stream": stream
	};
	SOCK.send("tempfile "+JSON.stringify(wrap));
}

var SUBSCRIPTIONS = {};
function subscribe_event(app, event, cb) {
  if (!SUBSCRIPTIONS[app]) SUBSCRIPTIONS[app] = {};
  if (!SUBSCRIPTIONS[app][event]) SUBSCRIPTIONS[app][event] = [];
  SUBSCRIPTIONS[app][event].push(cb);
  
  var d = { app: app, event: event }
  SOCK.send("sub "+JSON.stringify(d));
}

function json(cmd, vars, cb) { 
  if (SOCK && cmd.indexOf('http') != 0) {
    console.log('Sending json command via websocket: '+cmd+'?'+vars);
  	var pid = guid();
  	CMDS[pid] = cb;
	
	var params = {
	  "sessionid": sessionid
	};
	
	if (vars) {
	  var list = vars.split('&');
	  for (var i in list) {
		var pair = list[i].split('=');
		params[pair[0]] = decodeURIComponent(pair[1]);
	  }
	}
	
	var wrap = {
	  "pid": pid
	};
	
	var bot = document.URL.substring(0, document.URL.lastIndexOf('/'));
	bot = bot.substring(bot.lastIndexOf('/')+1);
	
	if (cmd.indexOf('../') == 0){
	  cmd = cmd.substring(3);
	  var i = cmd.indexOf('/');
	  bot = cmd.substring(0,i);
	  cmd = cmd.substring(i+1);
	  
	  if (bot == 'peer' && cmd.indexOf('remote/') == 0) {
	    cmd = cmd.substring(7);
	    i = cmd.indexOf('/');
	    wrap.peer = cmd.substring(0,i);
	    cmd = cmd.substring(i+1);
	    i = cmd.indexOf('/');
	    bot = cmd.substring(0,i);
	    cmd = cmd.substring(i+1);
	  }
	}
	
	wrap.bot = bot;
	wrap.cmd = cmd;
	wrap.params = params;
	
	SOCK.send("cmd "+JSON.stringify(wrap));
  }
  else {
    if (document.nbws_connecting){
      console.log('Waiting for websocket to connect...');
      setTimeout(function(){
        json(cmd, vars, cb);
      }, 10);
    }
    else {
        if (vars) vars = '&'+vars;
        else vars = '';
        vars = '?callback=?' + '&sessionid=' + sessionid + vars;
        $.getJSON(cmd+vars, function(result) {
          if (cb) cb(result);
        }).fail(function(x,y,z) {
          console.log( "error" );
          console.log( x );
          var result = { status: 'err', msg: x.responseText };
          if (cb) cb(result);
        });
      }
  }
}

function setCookie(c_name,value,exdays) { var exdate=new Date(); exdate.setDate(exdate.getDate() + exdays); var c_value=escape(value) + '; path=/'+((exdays==null) ? '' : '; expires='+exdate.toUTCString()); document.cookie=c_name + '=' + c_value; } 
function getCookie(c_name) { var i,x,y,ARRcookies=document.cookie.split(';'); for (i=0;i<ARRcookies.length;i++) { x=ARRcookies[i].substr(0,ARRcookies[i].indexOf('=')); y=ARRcookies[i].substr(ARRcookies[i].indexOf('=')+1); x=x.replace(/^\s+|\s+$/g,''); if (x==c_name) { return unescape(y); } } } 
function dget(id) { return document.getElementById(id); }

function getQueryParameter ( parameterName ) {
	  var queryString = window.location.search.substring(1);
	  var parameterName = parameterName + "=";
	  if ( queryString.length > 0 ) {
	    begin = queryString.indexOf ( parameterName );
	    if ( begin != -1 ) {
	      begin += parameterName.length;
	      end = queryString.indexOf ( "&" , begin );
	        if ( end == -1 ) {
	        end = queryString.lengthblock
	      }
	      return unescape ( queryString.substring ( begin, end ) );
	    }
	  }
	  return "null";
}

var sessionid = getQueryParameter("sessionid");
if (sessionid == 'null') sessionid = getCookie('sessionid');
else {
	setCookie('sessionid', sessionid);
//	var u = document.URL;
//	u = u.substring(0,u.indexOf('?'));
//	window.location = u;
}


function padZero(i){
  return (i<10 ? "0" : "")+i;
}

function parseDate(date){
	var now = new Date();
	var a1 = date.getHours()+":"+padZero(date.getMinutes());
	if (now.getYear() == date.getYear() && now.getMonth() == date.getMonth() && now.getDate() == date.getDate()) 
      return a1;

	var a0 = (date.getMonth()+1)+"/"+date.getDate()+"/"+(""+date.getFullYear()).substring(2);
	return a0+' '+a1;
}

if (typeof NEWBOUND_AJAX == 'undefined') try{ startWebSocket(); } catch (x) {}
