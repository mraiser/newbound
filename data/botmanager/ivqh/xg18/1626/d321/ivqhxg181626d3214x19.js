var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var el = $(ME).find("div");
  send_to_millis(1, "days", function(result) {
    el.text(JSON.stringify(result));
  });
};
