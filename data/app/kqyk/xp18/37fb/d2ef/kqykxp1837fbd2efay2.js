var me = this; 
var ME = $('#'+me.UUID)[0];

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  $(ME).find('.mydialog').css('display', 'block');
  $(ME).find('#username').focus();
  $(ME).find('.loginbutton').click(function(){
    var username = $(ME).find('#username').val();
    var password = $(ME).find('#password').val();
    json('../app/login', 'user='+encodeURIComponent(username)+'&pass='+encodeURIComponent(password), function(result){
      if (result.status == 'ok') {
        window.location.href = '../';
      }
      else {
        ui.snackbar({message:"Invalid username or password"});
        $(ME).find('.loginmsg').css('color', 'red');
      }
    });
  });
};
