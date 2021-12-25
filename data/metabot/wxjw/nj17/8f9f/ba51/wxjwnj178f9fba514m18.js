var me = this;
var ME = $('#'+me.UUID)[0];

var cbs = [];

var l = ME.DATA.label ? ME.DATA.label : 'Select a Command';
var a = ME.DATA.allownone ? true : false;

var cdb = null;
var cid = null;
var cmd = null;

me.ready = function(){
  var val = ME.DATA.value;
  if (val){
    var sa = val.split(":");
    cdb = sa[0];
    cid = sa[1];
    cmd = sa[2];
  }

  var ctl = ME.DATA.ctl;
  if (ctl) me.setControl(ctl);
  else {
    var args = {
      value: cdb ? cdb+":"+cid : null,
      allownone:a,
      ready:function(api){
        me.setControl(api.value());
      },
      cb:me.setControl
    };
    installControl($(ME).find('.cmdsellibwrap')[0], 'metabot', 'controlselect', function(api){
      me.ctlsel = api;
    }, args);
  }
  if (ME.DATA.cb) me.change(ME.DATA.cb);
};

me.setControl = function(ctl){
  me.lib = cdb = me.ctlsel.lib;
  me.ctl = cid = ctl;
  var ccb = function(val){
    cmd = val;
    for (var i in cbs) cbs[i](val, cmd);
  };
  json('../botmanager/read', 'db='+cdb+'&id='+cid, function(result){
    var cmdlist = me.cmdlist = result.data ? result.data.cmd : [];
    var data = {
      value:cmd,
      label: l,
      list: cmdlist,
      allownone:a,
      ready:function(api){
        if (ME.DATA.ready) ME.DATA.ready(me);
        ccb(api.value());
      },
      cb:ccb
    };

    installControl($(ME).find('.cmdselwrap')[0], 'metabot', 'select', function(api){}, data);
  });
};

me.change = function(cb){
  cbs.push(cb);
};
  
me.value = function(){
  return $(ME).find('.cmdselwrap').find('select').val();
};
  
me.command = function(){
  var val = $(ME).find('.cmdselwrap').find('select').val();
  val = getByProperty(me.cmdlist, 'id', val);
  return val;
};
  
me.name = function(){
  return me.command().name;
};
