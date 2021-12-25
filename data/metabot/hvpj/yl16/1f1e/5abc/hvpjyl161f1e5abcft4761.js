var me = this;
var ME = $('#'+me.UUID)[0];

var cbs = [];

var l = ME.DATA.label ? ME.DATA.label : 'Select a Control';
var a = ME.DATA.allownone ? true : false;

var cdb = null;
var cid = null;

me.ready = function(){
  var val = ME.DATA.value;
  if (val){
    var i = val.indexOf(':');
    cdb = val.substring(0,i);
    cid = val.substring(i+1);
  }

  var lib = ME.DATA.lib;
  if (lib) me.setLibrary(lib);
  else {
    var args = {
      value: cdb,
      allownone:a,
      ready:function(api){
        me.setLibrary(api.value());
      },
      cb:me.setLibrary
    };
    installControl($(ME).find('.ctlsellibwrap')[0], 'metabot', 'libraryselect', function(){}, args);
  }
  if (ME.DATA.cb) me.change(ME.DATA.cb);
};

me.setLibrary = function(lib){
  me.lib = cdb = lib;
  var ccb = function(val){
    cid = val;
    for (var i in cbs) cbs[i](val, cid);
  };
  json('../botmanager/read', 'db='+lib+'&id=controls', function(result){
    var ctllist = me.ctllist = result.data ? result.data.list : [];
    var data = {
      value:cid,
      label: l,
      list: ctllist,
      allownone:a,
      ready:function(api){
        if (ME.DATA.ready) ME.DATA.ready(me);
        ccb(api.value());
      },
      cb:ccb
    };

    installControl($(ME).find('.ctlselwrap')[0], 'metabot', 'select', function(api){}, data);
  });
};

me.change = function(cb){
  cbs.push(cb);
};
  
me.value = function(){
  return $(ME).find('.ctlselwrap').find('select').val();
};
  
me.name = function(){
  var val = $(ME).find('.ctlselwrap').find('select').val();
  val = getByProperty(me.ctllist, 'id', val);
  return val.name;
};
