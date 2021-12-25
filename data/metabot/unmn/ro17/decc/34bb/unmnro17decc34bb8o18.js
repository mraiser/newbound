var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  send_unused_controls(function(result){
    console.log(result);
  });
};