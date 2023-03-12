var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  json('../app/libs', null, function(result){
    var d = ME.DATA;
    if (!d.label) d.label = "Library";
    d.list = [];
    for (var i in result.data) d.list.push(result.data[i].id);
    d.list.sort();
    var el = $(ME).find('.selectlibwrap');
    installControl(el[0], 'app', 'select', function(api){
    }, d);
  });
};
