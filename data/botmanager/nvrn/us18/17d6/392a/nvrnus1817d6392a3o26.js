var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var el = $(ME).find("div");
  send_main(function(result) {
    el.text(JSON.stringify(result));
  });
};
