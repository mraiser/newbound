var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  me.data = {};
  var d = ME.DATA.item ? ME.DATA.item : "UNTITLED";
  me.data.item = d;
  
  me.wrap = $("<span />");
  me.rebuild();
  $(ME).append(me.wrap);
};

me.rebuild = function(cb){
  me.wrap.empty();
  
  var t = me.data.item;
  
  if (t.displayname) t = t.displayname;
  else if (t.name) t = t.name;
  else if (t.value) t = t.value;
  else if (t.id) t = t.id;
  
  me.wrap.html(t);
};