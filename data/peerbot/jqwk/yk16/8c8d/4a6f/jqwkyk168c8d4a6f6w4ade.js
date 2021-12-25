var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var db = ME.DATA.ctldb;
  var id = ME.DATA.ctlid;
  var data = ME.DATA.data;
  var cb = ME.DATA.save;
  var index = ME.DATA.index;
  
  installControl($(ME).find('.editctlwrap')[0], db, id+'_settings', function(api){
    me.settings = api;
  }, data);
  
  $(ME).find('.editcontrolbackbutton').click(function(x){
    $(ME).closest('.popmeup')[0].api.closeAndReset();
    $(ME).closest('.headsupdisplayinner')[0].api.refresh();
  });
  
  $(ME).find('.savebutton').click(function(){
    data.title = $('#editcontroltitlefield').val();
    var pos = $(ME).find('.editcontrolposgoeshere').find('select').val();
    var i = ME.DATA.list.indexOf(data);
    ME.DATA.list.splice(i,1);
    ME.DATA.list.splice(pos,0, data);
    if (me.settings && me.settings.save) me.settings.save(cb);
    else cb(data);
  });

  if (data.title) {
    $(ME).find('.editctlname').text(data.title);
    var el = $('#editcontroltitlefield').val(data.title).parent()[0];
    if (el.MaterialTextfield) el.MaterialTextfield.checkDirty();
  }

  var n = ME.DATA.list.length;
  var l = [];
  while (n-->0) l.unshift(''+n);
  
  var d = {
    "label": "Position",
    "value": ""+index,
    "list": l
  };
  installControl($(ME).find('.editcontrolposgoeshere')[0], 'metabot', 'select', function(api){
    componentHandler.upgradeAllRegistered();
  }, d);

};