var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  send_udp_connect("623aa1e7-272d-4823-b802-d4f786691760", "192.168.0.59", 45863, function(result){
    $(ME).find('div').append(JSON.stringify(result));
  });
};
