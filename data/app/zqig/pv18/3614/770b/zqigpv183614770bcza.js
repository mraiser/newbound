var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function() {
  send_hash("/home/mraiser/Desktop/9", function(result) {
    var el = ME.querySelector('div');
    el.textContent = JSON.stringify(result);
  });
};
