var me = this;
var ME = document.getElementById(me.UUID);

var cbs = [];

me.ready = function() {
  var selid = 'x' + guid();
  var val = ME.DATA.value ? ME.DATA.value : '';
  var sellable = ME.DATA.label ? ME.DATA.label : 'Options';
  var selhtml = '<div class="textinputlabel">' + sellable + '</div><select id="' + selid + '" class="mdl-selectfield__select textinput">';
  var data = ME.DATA.list ? ME.DATA.list.slice() : [{name:'opt1', id:'OOO1'},{name:'opt2', id:'OOO2'}];
  for (var i in data) {
    var id = data[i].name ? data[i].id : data[i];
    var name = data[i].name ? data[i].name : data[i];
    selhtml += '<option value="' + id + '"' + (id == val ? ' selected' : '') + '>' + name + '</option>';
  }
  selhtml += '</select></div>';
  ME.querySelector('.injectselect').innerHTML = selhtml;

  ME.querySelector('select').addEventListener('change', function(x) {
    var val = x.target.value;
    for (var i in cbs) cbs[i](val);
  });

  if (ME.DATA.cb) me.change(ME.DATA.cb);
  if (ME.DATA.ready) ME.DATA.ready(me);

  me.val = function(newval) {
    val = newval;
    dget(selid).value = val;
  };
};

me.change = function(cb) {
  cbs.push(cb);
};

me.value = function() {
  return ME.querySelector('select').value;
};

me.list = function() {
  return ME.DATA.list;
};
