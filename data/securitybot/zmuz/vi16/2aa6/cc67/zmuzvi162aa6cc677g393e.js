var me = this;
var ME = $('#'+me.UUID)[0];

json('../securitybot/listgroups', null, function(result){
  var list = result.data;
  var data = {list:list,label:"Select Group"}
  
  var ex = $(ME).data('exclude');
  if (ex) {
    var i = list.indexOf(ex);
    if (i != -1) list.splice(i,1);
  }
  
  installControl($(ME).find('.groupselect')[0], 'metabot', 'select', function(){}, data);
});