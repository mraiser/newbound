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
  // The form's submit covers the LOG IN button, Enter in either field, and
  // assistive tech alike (it used to hang off a click on an href-less <a>).
  ME.querySelector('#loginform').addEventListener('submit', function(e) {
    e.preventDefault();
    var username = ME.querySelector('#username').value;
    var password = ME.querySelector('#password').value;
    var remember = ME.querySelector('#remember').checked;
    loginError(false);
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
      else loginError(true);
    });
  });
}

// A failed login says so in the message line itself (WCAG 3.3.1, 4.1.3,
// 1.4.1): new words, an icon, error colour, announced, both fields invalid.
var LOGIN_HINT = 'Please enter your username and password to log in.';
function loginError(on) {
  var msg = ME.querySelector('.loginmsg');
  msg.classList.toggle('loginmsg-err', on);
  if (on) {
    msg.setAttribute('role', 'alert');
    msg.innerHTML = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    var t = document.createElement('span');
    t.textContent = 'Wrong username or password.';
    msg.appendChild(t);
  } else {
    msg.removeAttribute('role');
    msg.textContent = LOGIN_HINT;
  }
  ['#username', '#password'].forEach(function(s) {
    var f = ME.querySelector(s);
    if (on) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid');
  });
}
