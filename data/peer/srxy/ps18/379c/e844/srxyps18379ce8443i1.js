var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function(){
  send_udp_connect("192.168.0.59", 45863, function(result){
    ME.querySelector('div').insertAdjacentText('beforeend', JSON.stringify(result));
  });
};
