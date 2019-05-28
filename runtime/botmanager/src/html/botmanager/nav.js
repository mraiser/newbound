function json(cmd, vars, cb) { 
	if (vars) vars = '&'+vars; 
	else vars = ''; 
	vars = '?callback=?' + '&sessionid=' + sessionid + vars; 
	$.getJSON(botserver+cmd+vars, function(result) { 
		console.log(result); 
		if (result.status == 'err' && (result.msg == 'INVALID SESSION ID' || result.msg == 'UNAUTHORIZED')) 
			checkLogin(); 
		else if (cb) cb(result); 
	}).fail(function(x) {
	  console.log( "error" );
	  console.log( x );
	  var result = { status: 'err', msg: x.responseText };
	  if (cb) cb(result); 
	}); 
}

function setCookie(c_name,value,exdays) { var exdate=new Date(); exdate.setDate(exdate.getDate() + exdays); var c_value=escape(value) + '; path=/'+((exdays==null) ? '' : '; expires='+exdate.toUTCString()); document.cookie=c_name + '=' + c_value; } 
function getCookie(c_name) { var i,x,y,ARRcookies=document.cookie.split(';'); for (i=0;i<ARRcookies.length;i++) { x=ARRcookies[i].substr(0,ARRcookies[i].indexOf('=')); y=ARRcookies[i].substr(ARRcookies[i].indexOf('=')+1); x=x.replace(/^\s+|\s+$/g,''); if (x==c_name) { return unescape(y); } } } 
function dget(id) { return document.getElementById(id); }

var botserver = '';
var sessionid = getQueryParameter("sessionid");
if (sessionid == 'null') sessionid = getCookie('sessionid');
else {
	setCookie('sessionid', sessionid);
	var u = document.URL;
	u = u.substring(0,u.indexOf('?'));
	window.location = u;
}

function getQueryParameter ( parameterName ) {
	  var queryString = window.top.location.search.substring(1);
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

document.nbnav = new function() {
  this.gotoPage = function(page) {
    var url;
    if (page == 'local') url = '/';
    else {
      url = document.URL;
      url = url.substring(0,url.indexOf(page))+page+"/botmanager/index.html";
    }
    window.location = url;
  }
  
  var newhtml = "<div style='position:absolute;top:10px;right:10px;color:white;font-size:xx-small;'>";
  newhtml += "<select id='nbnav_peer' onchange='document.nbnav.gotoPage($(this).val());'>";

  var chunk = '/peerbot/remote/';

  function buildOptions(url){
	  var x = url.lastIndexOf(chunk);
	  if (x == -1){
		  $.getJSON('/peerbot/getpeerinfo', function(result) { 
			  newhtml += "<option value='local'>"+result.name+"</option>";
			  newhtml += "</select></div>";
			  $('body').append(newhtml); 
		  });
	  }
	  else {
          var peerid = url.substring(x+chunk.length);
          url = url.substring(0,x+chunk.length);
          var y = peerid.indexOf('/');
          if (y != -1) peerid = peerid.substring(0,y);
          console.log(url);
		  
          $.getJSON(url+peerid+'/peerbot/getmachineid', function(result) {
              console.log(peerid+"/"+result.msg+"/"+x);
              newhtml += "<option value='"+peerid+"'>"+result.msg+"</option>";
              buildOptions(url.substring(0,x));
          });
	  }
  }
  
  buildOptions(document.URL);
};


function checkLogin(){
	window.location.href="../botmanager/login.html";
}