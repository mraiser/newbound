var me = this; 
var ME = $('#'+me.UUID)[0];

var lib = "scratch";
var ctl = "scratch";
var cmd = "do_the_thing";
var lang = "rust";
var return_type = "JSONObject";
var params = [];
var imports = "";
var code_body = "DataObject::xfrom_string(\"{}\")";

me.ready = function(){
  send_upsert_command(lib, ctl, cmd, lang, return_type, params, imports, code_body, function(result){
    $(ME).append('<pre>'+JSON.stringify(result)+'</pre>');
  });
};
