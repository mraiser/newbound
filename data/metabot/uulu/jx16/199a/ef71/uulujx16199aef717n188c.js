var me = this;
var ME = $('#'+me.UUID)[0];

var cbs = [];

me.ready = function(){
  var selid = 'x'+guid();
  var val = ME.DATA.value ? ME.DATA.value : '';
  var sellable = ME.DATA.label ? ME.DATA.label : 'Options';
  var selhtml = '<div class="mdl-selectfield mdl-js-selectfield mdl-selectfield--floating-label"><select id="'+selid+'" class="mdl-selectfield__select">';
  var connectedonly = ME.DATA.connected;
  
  var data = ME.DATA.list ? ME.DATA.list : [{name:'opt1', id:'OOO1'},{name:'opt2', id:'OOO2'}];

  if (ME.DATA.allownone && !ME.DATA.value) data.unshift({name:' ', id:'', connected:true});
  else if (ME.DATA.addlocal) data.unshift({name:'(local)', id:'local', connected:true});
  if (!val) val = '';
  
  me.rebuild = function(){
    for (var i in data){
      if (!connectedonly || data[i].connected){
        var id = data[i].name ? data[i].id : data[i];
        var name = data[i].name ? data[i].name : data[i];
        selhtml += '<option value="'+id+'"'+(id == val ? ' selected' : '')+'>'+name+'</option>';
      }
    }
    selhtml += '</select><label class="mdl-selectfield__label" for="'+selid+'">'+sellable+'</label><span class="mdl-selectfield__error">Select a value</span></div>';
    $(ME).find('.injectselect').html(selhtml);
    componentHandler.upgradeAllRegistered();

    $(ME).find('select').on('change', function(x){
      var val = $(x.target).val();
      for (var i in cbs) cbs[i](val);
    });
  }
  me.rebuild();
  
  if (ME.DATA.cb) me.change(ME.DATA.cb);
  if (ME.DATA.ready) ME.DATA.ready(me);
  
  me.val = function(newval){
    val = newval;
    $('#'+selid).val(val);
  };
};

me.change = function(cb){
  cbs.push(cb);
};

me.value = function(){
  return $(ME).find('select').val();
};

me.list = function(){
  return ME.DATA.list;
};
