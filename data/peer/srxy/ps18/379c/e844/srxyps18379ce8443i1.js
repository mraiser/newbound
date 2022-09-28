var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  send_tcp_connect("x-a5de51ae-667c-4408-b60f-792b578a1a52", "127.0.0.1", 35909, function(result){
    $(ME).find('div').append(JSON.stringify(result));
  });
};
