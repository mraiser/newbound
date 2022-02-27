var me = this;
var ME = $('#'+me.UUID)[0];

json('../securitybot/listgroups', null, function(result){
  var list = document.body.localgroups = result.data;
  var label = ME.DATA.label ? ME.DATA.label : "Select Group";
  var allownone = ME.DATA.allownone ? ME.DATA.allownone : false;
  var data = {list:list,label:label,allownone:allownone};
  
  var ex = $(ME).data('exclude');
  if (ex) {
    var i = list.indexOf(ex);
    if (i != -1) list.splice(i,1);
  }
  
  installControl($(ME).find('.groupselect')[0], 'metabot', 'select', function(){}, data);
});