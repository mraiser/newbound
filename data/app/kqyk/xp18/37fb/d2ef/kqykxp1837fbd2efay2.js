var me = this; 
var ME = $('#'+me.UUID)[0];

me.uiReady = function(ui){
  me.ui = ui;
  var check = getCookie('obj_placeholder');
  if (check) {
    var pair = JSON.parse(atob(check));
    json('../app/login', "user="+encodeURIComponent(pair[0])+"&pass="+encodeURIComponent(pair[1]), function(result){
        if (result.status == 'ok') {
          window.location.href='../';
        }
        else showlogin();
    });
  }
  else showlogin();
};

function showlogin(){
  $(ME).find('.wrap').css('display', 'block');
  $(ME).find('.mydialog').css('display', 'block');
  $(ME).find('#username').focus();
  $(ME).find('.loginbutton').click(function(){
    var username = $(ME).find('#username').val();
    var password = $(ME).find('#password').val();
    var remember = $(ME).find('#remember').prop('checked');
    json('../app/login', 'user='+encodeURIComponent(username)+'&pass='+encodeURIComponent(password), function(result){
      if (result.status == 'ok') {
        if (remember) {
          savestring = btoa(JSON.stringify([username,password]));
          setCookie("obj_placeholder",savestring,365);
        }
        else {
          setCookie("obj_placeholder",null,0);
        }
        window.location.href = document.referrer ? document.referrer : '../';
      }
      else {
        ui.snackbar({message:"Invalid username or password"});
        $(ME).find('.loginmsg').css('color', 'red');
      }
    });
  });
}
