var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var d = {};
  d.ready = function(x) { me.selectLib(x.value()); };
  d.cb = me.selectLib;
  var el = $(ME).find('.selectctllibwrap');
  installControl(el[0], 'dev', 'selectlib', function(api){}, d);
};

me.selectLib = function(lib) {
  json('../app/read', 'lib='+encodeURIComponent(lib)+'&id=controls', function(result){
    var d = ME.DATA;
    if (!d.label) d.label = "Control";
    d.list = result.data.list;
    d.list.sort(function(a,b){return a.name > b.name;});
    var el = $(ME).find('.selectctlwrap');
    installControl(el[0], 'app', 'select', function(api){
    }, d);
  });
};