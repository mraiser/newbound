var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  //componentHandler.upgradeAllRegistered();
  send_report(function(result){
    $(ME).find('.showreport').text(result.msg);
  });
};

$(document).click(function(event) {
   window.lastElementClicked = event.target;
});
