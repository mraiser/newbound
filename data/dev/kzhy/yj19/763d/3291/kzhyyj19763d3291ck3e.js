var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(api){
  
  var parent = $(ME).parent();
  while (!parent[0].meta) { 
    parent = parent.parent(); 
  }
  var p = parent[0];
  var meta = p.meta;
  var lib = meta.db;
  var ctl = meta.name;
  var uuid = p.id;
  
  send_list_plugins(function(result){
    var lookup = result.data;
    for (var key in lookup) {
      var p = lookup[key];
      if (p.target_lib == lib && p.target_ctl == ctl) {
        installControl(p.selector, p.plugin_lib, p.plugin_ctl, function(result){
          // PLUGIN READY
        }, meta);
      }
    }
  });
};
