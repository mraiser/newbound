var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function() {
  me.data = {};
  var d = ME.DATA.item ? ME.DATA.item : "UNTITLED";
  me.data.item = d;

  me.wrap = document.createElement('span');
  me.rebuild();
  ME.appendChild(me.wrap);
};

me.rebuild = function(cb) {
  var t = me.data.item;

  if (t.displayname) t = t.displayname;
  else if (t.name) t = t.name;
  else if (t.value) t = t.value;
  else if (t.id) t = t.id;

  me.wrap.innerHTML = t;
};
