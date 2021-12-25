var me = this; 
var ME = $('#'+me.UUID)[0];

var STORE = 'a51f6394-730b-4f64-83b0-96ad75f84537';

$(ME).find('#servicesrestartbutton').click(function(){
  debugger;
  $(ME).find('#servicesrestartbutton').css('display', 'none');
  $(ME).find('#servicesrestartmsg').html('<i>Restarting services, please wait.</i><br><br>Stopping services...');
  
  var UP = true;
  
  function waitForIt(xxx){
    if (xxx) console.log(xxx);
    console.log('NOT YET - '+(UP ? "UP" : "DOWN"));
    
    
    
    $.ajax({
      type:     "get",
      data:     {uuid: STORE},
      cache:    false,
      url:      "../peerbot/connectionstatus",
      dataType: "json",
      error: function (request, error) {
        console.log(error);
        $(ME).find('#servicesrestartmsg').html('<i>Services have been stopped.</i><br><br>Restarting services...');
        UP = false;
        setTimeout(waitForIt, 1000);
      },
      success: function (result) {
        if (result.msg == 'OK') {
          if (UP) setTimeout(waitForIt, 1000);
          else {
            console.log('NOW');
            $(ME).find('#servicesrestartmsg').html('Restart complete.');
            window.location.href='index.html';
          }
        }
        else {
  //        $('#servicesrestartmsg').html('<i>Services have been stopped.</i><br><br>Restarting services...');
          UP = false;
          setTimeout(waitForIt, 1000);
        }
      }
    });
  }
  waitForIt();
  
  $.getJSON('../botmanager/restart', function(result) {});
});