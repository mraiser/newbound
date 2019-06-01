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

function D$(db, ctl, name, cb){
  lookupID(db, ctl, function(id){
    if (id) {
      ctl = getByProperty(CTLCACHE[db].list, 'id', id);
      if (ctl) {
        if (ctl.data) {
          var data = getByProperty(ctl.data.data, "name", name);
          if (!data) cb(null);
          else {
            json('read', 'db='+encodeURIComponent(db)+'&id='+encodeURIComponent(data.id), function(result){
              if (result.status != 'ok') cb(null);
              else cb(result.data);
			});
		  }
		}
        else {
          json('read', 'db='+encodeURIComponent(db)+'&id='+encodeURIComponent(id), function(result){
            if (result.status != 'ok') cb(null);
            else {
              ctl.data = result.data;
              D$(db, id, name, cb);
			}
          });
        }
	  }
	  else cb(null);
    }
  });
}

function lookupID(db, name, cb){

  var now = new Date().getTime();

  var x = CTLCACHE[db];
  if (!x) x = CTLCACHE[db] = { when: 0, waiting: {} };
  if (now - x.when > CACHEMILLIS) {
    if (x.fetching) setTimeout(function(){ lookupID(db, name, cb) }, 100);
    else {
      x.fetching = true;
	  json('../botmanager/read', 'db='+encodeURIComponent(db)+'&id=controls', function(result){
		if (result.status != 'ok') cb(null);
		else {
		  x.when = now;
		  x.fetching = false;
		  x.list = result.data.list;
		  lookupID(db, name, cb);
		}
	  });
	}
  }
  else {
    var y = getByProperty(x.list, 'name', name);
    cb(y ? y.id : name);
  }
}

function fetchNextData(db, data, whendone){
  if (DATACACHE[db] && DATACACHE[db][data.id] && DATACACHE[db][data.id].data) whendone(JSON.parse(JSON.stringify(DATACACHE[db][data.id].data)));
  else{
    if (!DATACACHE[db]) DATACACHE[db] = {};
    if (DATACACHE[db][data.id]){
      DATACACHE[db][data.id].list.push({db:db, data:data, xxx:whendone});
    }    
    else{
	  DATACACHE[db][data.id] = { list:[] };
	  
	  json('../botmanager/read', 'db='+db+'&id='+data.id, function(result){
		DATACACHE[db][data.id].data = result;
	  
		for (var i in DATACACHE[db][data.id].list){
		  DATACACHE[db][data.id].list[i].xxx(JSON.parse(JSON.stringify(result)));
		}
	  
		whendone(result);
	  });
    }
  }
}

function handlenextdata(el, dat, db, finish){
  if (dat.length == 0) finish();
  else {
	var data = dat.shift();
	fetchNextData(db, data, function(result){
	  $(el).data(data.name, result.data);
	  handlenextdata(el, dat, db, finish);
	});
  }		  
}

function build(el, apijs, html, css, js){
	var newhtml = '<'+'style scoped>'+css+'<'+'/style>';
	newhtml += html;
	newhtml += '<'+'script>$("#'+$(el)[0].id+'")[0].api = new function() { this.UUID = "'+$(el)[0].id+'";\n'+apijs+'\n'+js+'\n };<'+'/script>';
	return newhtml;
}

function getjsapi(db, id, cb){
  if (alljsapis[db] && alljsapis[db][id]) 
	if (Array.isArray(alljsapis[db][id])) alljsapis[db][id].push(cb);
	else cb(db, id, alljsapis[db][id]);
  else {
	if (!alljsapis[db]) alljsapis[db] = {};
	if (!alljsapis[db][id]) alljsapis[db][id] = [cb];
	send_buildjsapi(db, id, function(result){
	  var n = alljsapis[db][id].length;
	  for (var i=0;i<n;i++) alljsapis[db][id][i](db, id, result);
	  alljsapis[db][id] = result;
	});
  }
}
    
function installControl(el, db, id, cb, data) {
  var oldhtml = $(el).children();
  
  if (!data){
    var d2 = $(el).data('control');
    if (!d2) {
      data = { db:db, id:id };
      $(el).data('control', data);
	}
	else data = d2;
  }
  else $(el).data('control', data);
  $(el)[0].ctl = data;

  if (!data) data = { db:db, id:id };
  if (!$(el).data('control')) $(el).data('control', data);
  $(el)[0].DATA = data;

  lookupID(db, id, function(id2){
	if (id2 != null) id = id2;
    
	function handlejsapi(db, id, result){
	  console.log("JSAPI "+db+"/"+id+": "+JSON.stringify(result));
	  var apijs = result.data ? result.data.js : '';
	  
	  function getctlmeta(db, id, cb){
	    if (allmetas[db] && allmetas[db][id]) {
	      if (Array.isArray(allmetas[db][id])) allmetas[db][id].push(cb);
	      else cb(db, id, allmetas[db][id]);
		}
		else {
		  if (!allmetas[db]) allmetas[db] = {};
		  if (!allmetas[db][id]) allmetas[db][id] = [cb];
		  json('../botmanager/read', 'db='+encodeURIComponent(db)+'&id='+encodeURIComponent(id), function(result){
			var n = allmetas[db][id].length;
			for (var i=0;i<n;i++) allmetas[db][id][i](db, id, Object.assign({}, result));
			allmetas[db][id] = result;
		  });
		}	  
	  }

	  function handlectlmeta(db, id, result){
if (!result.data){
  if (result.status == 'err' && result.msg == 'UNAUTHORIZED' && el == document.body)
    window.location.href = '../botmanager/login.html'
  console.log("NO DATA FOR "+db+'/'+id);
  console.log(JSON.stringify(result));
}	  
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
		if (dat != null && dat.length>0) handlenextdata(el, dat.slice(), db, finish)
		else finish();
	  }
	  getctlmeta(db, id, handlectlmeta);
	}

	getjsapi(db, id, handlejsapi);
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
  if (c.db){
	installControl(el, c.db, c.id, cb);
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

function send_buildjsapi(db, id, cb){
  $.ajax({
	  url: "../botmanager/generated/js/"+encodeURIComponent(db)+"/"+encodeURIComponent(id)+".js", 
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
	  else if (div && div.api && div.api.wscb) div.api.wscb(o);
	  else if (typeof WSCB != 'undefined') WSCB(o);
	  else console.log("Received unexpected websocket data: "+e.data);
	};
  }
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
	  
	  if (bot == 'peerbot' && cmd.indexOf('remote/') == 0) {
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
          //debugger;
          // FIXME - Never gets here on python
          if (cb) cb(result);
        }).fail(function(x,y) {
          //debugger;
          console.log('This should not happen');
          console.log(x);
          console.log(y);
          if (cb && x.status && x.status == 200) {
            t = x.responseText;
            x = JSON.parse(t);
            cb(x); // FIXME - WTF?

            /**

            It is possible that AJAX is broken.
            Possibly an HTTP issue. :(
            parsererror

            **/
          }
          else{
              console.log( "error" );
              console.log( x );
              var result = { status: 'err', msg: x.responseText };
              if (cb) cb(result);
          }
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

//if (typeof NEWBOUND_AJAX == 'undefined') try{ startWebSocket(); } catch (x) {}