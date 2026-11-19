var me = this;
var ME = document.getElementById(me.UUID);

me.uiReady = function(ui) {
  me.ui = ui;
  var check = getCookie('obj_placeholder');
  if (check) {
    var pair = JSON.parse(atob(check));
    json('../app/login', "user="+encodeURIComponent(pair[0])+"&pass="+encodeURIComponent(pair[1]), function(result) {
        if (result.status == 'ok') {
          adoptSession(result);
          window.location.href='../';
        }
        else showlogin();
    });
  }
  else showlogin();
};

// A successful login moves the session to a fresh id (session fixation fix).
// Over HTTP the response's Set-Cookie already carries it; over the websocket
// nothing does, so store it here before the page navigates.
function adoptSession(result) {
  if (result && result.sessionid) {
    setCookie('sessionid', result.sessionid, 365);
    sessionid = result.sessionid;
  }
}

function showlogin() {
  ME.querySelector('.wrap').style.display = 'block';
  ME.querySelector('.mydialog').style.display = 'block';
  ME.querySelector('#username').focus();
  ME.querySelector('.loginbutton').addEventListener('click', function() {
    var username = ME.querySelector('#username').value;
    var password = ME.querySelector('#password').value;
    var remember = ME.querySelector('#remember').checked;
    json('../app/login', 'user='+encodeURIComponent(username)+'&pass='+encodeURIComponent(password), function(result) {
      if (result.status == 'ok') {
        adoptSession(result);
        if (remember) {
          var savestring = btoa(JSON.stringify([username,password]));
          setCookie("obj_placeholder",savestring,365);
        }
        else {
          setCookie("obj_placeholder",null,0);
        }
        window.location.href = document.referrer ? document.referrer : '../';
      }
      else {
        me.ui.snackbar({message:"Invalid username or password"});
        ME.querySelector('.loginmsg').style.color = 'red';
      }
    });
  });
}
