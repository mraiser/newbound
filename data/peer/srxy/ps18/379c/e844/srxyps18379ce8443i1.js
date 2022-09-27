var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  send_init(function(result){
    $(ME).find('div').append(JSON.stringify(result));
  });
};
