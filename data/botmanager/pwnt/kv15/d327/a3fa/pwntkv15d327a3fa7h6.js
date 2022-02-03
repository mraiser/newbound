var me = this; 
var ME = $('#'+me.UUID)[0];

$('body').addClass('ui-body-b');

var sid2 = getQueryParameter("sessionid");
if (sid2 != 'null') {
  setCookie('sessionid', sid2);
  var u = document.URL;
  u = u.substring(0,u.indexOf('?'));
  window.location = u;
}

//json('../botmanager/listbots', null, function(result){
//  if (result.status != 'ok') window.location='../botmanager/login.html';
//}); 