var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  send_hash("/home/mraiser/Desktop/9", function(result){
    var el = $(ME).find('div');
    el.text(JSON.stringify(result));
  });
};
