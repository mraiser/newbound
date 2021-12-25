var me = this;
var ME = $('#'+me.UUID)[0];

me.data = {
  "tabs": [ "Bots", "Settings" ],
  "ctls": [ "botlist", "settings" ]
};

me.ready = function(){
  if ($(ME).data('control').tabs) me.data = $(ME).data('control');
  buildTabs();
};

function buildTabs(){
  var newhtml1 = '<div data-role="navbar" class="ui-body-b"><ul>';
  
  var n = me.data.tabs.length;
  var w = $(ME).width()/n;
  
  for (var i in me.data.tabs){
    var tab = me.data.tabs[i];
    var ctl = me.data.ctls[i];
    var claz = 'topnavitem' + ((i==0) ? ' ui-btn-active' : '');
    newhtml1 += '<li><a class="'+claz+'" id="nbt_'+ctl+'">'+tab+'</a></li>';
  }
  newhtml1 += '</ul></div>';
  $(ME).find('.navwrap').html(newhtml1).trigger('create');
  
  $(ME).find('.topnavitem').click(function(){
    for (var i in me.data.ctls){
      var id = this.id.substring(4);
      var ctl = me.data.ctls[i];
      var el = $('#'+ctl);
      if (ctl != id) el.css('display', 'none');
      else {
        el.css('opacity', "0");
        el.css('display', "block");
        el.animate({"opacity":"1"},500);
      }
    }
  });
  
  $($(ME).find('.topnavitem')[0]).click();
}