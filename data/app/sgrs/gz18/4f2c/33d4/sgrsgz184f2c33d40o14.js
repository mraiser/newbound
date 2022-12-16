var me = this;
var ME = $('#'+me.UUID)[0];

var cbs = [];

me.ready = function(){
  var selid = 'x'+guid();
  var val = ME.DATA.value ? ME.DATA.value : '';
  var sellable = ME.DATA.label ? ME.DATA.label : 'Options';
  var selhtml = '<div class="textinputlabel">'+sellable+'</div><select id="'+selid+'" class="mdl-selectfield__select textinput">';
  var data = ME.DATA.list ? ME.DATA.list.slice() : [{name:'opt1', id:'OOO1'},{name:'opt2', id:'OOO2'}];
  for (var i in data){
    var id = data[i].name ? data[i].id : data[i];
    var name = data[i].name ? data[i].name : data[i];
    selhtml += '<option value="'+id+'"'+(id == val ? ' selected' : '')+'>'+name+'</option>';
  }
  selhtml += '</select></div>';
  $(ME).find('.injectselect').html(selhtml);

  $(ME).find('select').on('change', function(x){
    var val = $(x.target).val();
    for (var i in cbs) cbs[i](val);
  });
  
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