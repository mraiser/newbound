var me = this;
var ME = $('#'+me.UUID)[0];

var cbs = [];

me.ready = function(){
  componentHandler.upgradeAllRegistered();

  var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';

  function validateString(val){
    if (val.length == 0) return false;
    var i = val.length;
    while (i-->0) if (validchars.indexOf(val.charAt(i)) == -1) return false;
    return true;
  }
  
  json('../botmanager/listbots', 'includeself=true', function(result){
    me.apps = result.data;
    sort();
    rebuild();
    if (ME.DATA.cb) me.change(ME.DATA.cb);
  });
}

function sort(){
  me.apps.sort(function(a, b) { 
      return a.name > b.name ? 1 : a.name == b.name ? 0 : -1;
  })
}

function rebuild(){
  var l = ME.DATA.label ? ME.DATA.label : 'Select an App';
  var a = ME.DATA.allownone ? true : false;

  var data = {
    label: l,
    list: me.apps,
    value: ME.DATA.value,
    allownone:a,
    cb:function(val){
      for (var i in cbs) cbs[i](val);
    },
    ready:function(api){
      me.select = api;
      me.value = me.select.value;
      me.list = me.select.list;
      me.rebuild = me.select.rebuild;
      if (ME.DATA.ready) ME.DATA.ready(me);
    }
  };

  installControl($(ME).find('.appselwrap')[0], 'metabot', 'select', function(api){}, data);
}

me.change = function(cb){
  cbs.push(cb);
};
