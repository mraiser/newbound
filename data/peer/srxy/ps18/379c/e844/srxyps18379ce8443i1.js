var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  send_udp_connect("192.168.0.59", 45863, function(result){
    $(ME).find('div').append(JSON.stringify(result));
  });
};
