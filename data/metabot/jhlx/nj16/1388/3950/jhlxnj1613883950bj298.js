var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  componentHandler.upgradeAllRegistered();
};

$(document).click(function(event) {
   window.lastElementClicked = event.target;
});
