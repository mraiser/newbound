var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  send_exec("a5de51ae-667c-4408-b60f-792b578a1a52", "app", "unique_session_id", {}, function(result){
    $(ME).find('div').append(JSON.stringify(result));
  });
};
