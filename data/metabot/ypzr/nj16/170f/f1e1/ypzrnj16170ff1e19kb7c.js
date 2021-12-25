var me = this;
var ME = $('#'+me.UUID)[0];

TB = me;

me.ready = function(){

  //  var data = { "db": db, "ctl": id, "timer": timer, "name": timer.name, "data": me.CTLDATA, "ctlapi": me };
  
  buildDigitSelect(0, 1, '.h1select');
  buildDigitSelect(0, 5, '.m1select');
  buildDigitSelect(0, 3, '.d1select');
  buildDigitSelect(0, 9, '.digitselect');
  var thisyear = new Date().getFullYear();
  buildDigitSelect(thisyear, thisyear+10, '.yearselect');
  
  var units = '';
  var tus = [ 'milliseconds', 'seconds', 'minutes', 'hours', 'days' ];
  i = tus.length;
  while (i-->0) units = '<option>'+tus[i]+'</option>' + units;
  $('.timeunitselect').html(units).trigger('create');
  
  var months = '';
  var ms = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];
  i = ms.length;
  while (i-->0) months = '<option>'+ms[i]+'</option>' + months;
  $('.monthselect').html(months).trigger('create');
  
  var newhtml = ''
  for (var i in ME.DATA.ctlapi.CTLDATA.cmd){
    var c = ME.DATA.ctlapi.CTLDATA.cmd[i];
    newhtml += '<option value="'+c.id+'">'+c.name+'</option>';
  }

  $('#timer_edit_task').html(newhtml);

  editTimer(ME.DATA.timer.id);
};

var months = '';
var ms = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];
i = ms.length;
while (i-->0) months = '<option>'+ms[i]+'</option>' + months;
$('.monthselect').html(months);

  
function buildDigitSelect(start, stop, el){
  var digits = '';
  var i = stop+1;
  while (i-->start) digits = '<option>'+i+'</option>' + digits;
  $(el).html(digits);
}

function deleteTimer(){
  var uuid = $('#timer_edit')[0].uuid;
  if (confirm('Are you sure you want to delete this timer? This cannot be undone.')) json('../botmanager/timer', 'mode=kill&id='+encodeURIComponent(uuid), function(result){
    if (result.status != 'ok') alert(result.msg);
    else json('../botmanager/delete', 'db='+ME.DATA.db+'&id='+encodeURIComponent(uuid), function(result){
      var d = getByProperty(ME.DATA.ctlapi.CTLDATA.timer, 'id', uuid);
      var i = ME.DATA.ctlapi.CTLDATA.timer.indexOf(d);
      ME.DATA.ctlapi.CTLDATA.timer.splice(i,1);
      ME.DATA.ctlapi.saveControl();
      ME.DATA.ctlapi.buildTimerList();
      closeTimer();
    });
  });
}
$('#deletethetimerbutton').click(deleteTimer);

function closeTimer(){
  $('.api-main').css('display', 'block');
  $('.api-edittimer').css('display', 'none');
}
$('#cancelthetimerbutton').click(closeTimer);


function saveTimer(){
  var DB = ME.DATA.db;
  var data = $('#timer_edit')[0].data;
  var uuid = $('#timer_edit')[0].uuid;
  data.cmd = $('#timer_edit_task').val();
  data.cmddb = DB;
  data.params = {};

  var ok = true;
  var cmd = getByProperty(ME.DATA.cmd, 'id', data.cmd);
  $('.cp_'+data.cmd).each(function(i, el){
    var p = $('#timer_edit_params')[0].data.params[i];
    try
    {
      var v = p.type.indexOf('JSON') == 0 ? JSON.parse(el.value) : el.value;
      data.params[p.name] = v;
    }
    catch (x) { alert('Parameter '+p.name+' is not valid JSON'); ok = false; }
  });
  
  if (!ok) return;

  if ($('#timer_edit_start-1').prop('checked')) {
    data.start = 0;
    data.startunit = 'milliseconds';
  }
  else if ($('#timer_edit_start-2').prop('checked')){
    var d1 = $('#tes2-1').val();
    var d2 = $('#tes2-2').val();
    data.start = parseInt(d1)*10 + parseInt(d2);
    data.startunit = $('#tes2-unit').val();
  }
  else {
    data.start = new Date(extractTimerStart()).getTime();
    data.startunit = 'milliseconds';
  }
  
  data.repeat = $('#timer_edit_repeat').prop('checked');
  
  var d1 = $('#timer_edit_repeat1').val();
  var d2 = $('#timer_edit_repeat2').val();
  data.interval = parseInt(d1)*10 + parseInt(d2);
  data.intervalunit = $('#timer_edit_repeat_unit').val();

  json('../botmanager/timer', 'mode=set&params='+encodeURIComponent(JSON.stringify(data))+'&id='+encodeURIComponent(uuid), function(result){
    if (result.status != 'ok') alert(result.msg);
    else json('../botmanager/write', 'db='+DB+'&data='+encodeURIComponent(JSON.stringify(data))+'&id='+encodeURIComponent(uuid), function(result){
      if (result.status != 'ok') alert(result.msg);
      else $('#cancelthetimerbutton').click();
    });
  });
}
$('#savethetimerbutton').click(saveTimer);

function extractTimerStart(){
    var h = $('#tes3-h1').val()+''+$('#tes3-h2').val();
    var m = $('#tes3-m1').val()+''+$('#tes3-m2').val();
    var a = $('#tes3-ampm').val();

    var mm = $('#tes3-m').val();
    var dd = $('#tes3-d1').val()+''+$('#tes3-d2').val();
    var y = $('#tes3-y').val();
    
    return mm+" "+dd+", "+y+" "+h+":"+m+" "+a;
}



function editTimer(id, cb){
  $('#timer_edit_msg').html('');
  adjustMinuteSelect('0', 'tes3-h2');
  adjustDaySelect("tes3-m", "tes3-d", "tes3-y");
  var data = ME.DATA.timer;
  $('.timer_edit_name').text(data.name);
  $('#timer_edit')[0].uuid = id;
  json('../botmanager/read', 'db='+ME.DATA.db+'&id='+encodeURIComponent(id), function(result){
    if (result.status != 'ok') error(result.msg, 'timer_edit_msg');
    else {
      var d = result.data;
      $('#timer_edit')[0].data = d;
      
      if (d.cmd) $('#timer_edit_task').val(d.cmd);
      setTaskParams($('#timer_edit_task').val());
      var tes = d.start == 0 ? 1 : d.start < 100 ? 2 : 3;
      $('.timer_edit_start').prop('checked', false);
      $('#timer_edit_start-'+tes).prop('checked', true);
      
      if (tes == 2) {
        var d1 = Math.floor(d.start/10);
        var d2 = d.start - (d1 * 10);
        $('#tes2-1').val(''+d1);
        $('#tes2-2').val(''+d2);
        $('#tes2-unit').val(d.startunit);
      }
      else if (tes == 3) {
        var date = new Date();
        date.setTime(d.start);
        
        var h = date.getHours();
        var pm = h > 11;
        if (h>12) h -= 12;
        else if (h == 0) h = 12;
        
        var h1 = Math.floor(h / 10);
        var h2 = h - (h1 * 10);
        $('#tes3-h1').val(''+h1);
        $('#tes3-h2').val(''+h2);
        
        var m = date.getMinutes();
        var m1 = Math.floor(m / 10);
        var m2 = m - (m1 * 10);
        $('#tes3-m1').val(''+m1);
        $('#tes3-m2').val(''+m2);
        $('#tes3-ampm').val(pm ? 'PM' : 'AM');
        $('#tes3-m').val(ms[date.getMonth()]);
        
        var day = date.getDate();
        var d1 = Math.floor(day / 10);
        var d2 = day - (d1 * 10);
        $('#tes3-d1').val(''+d1);
        $('#tes3-d2').val(''+d2);
        $('#tes3-y').val(date.getFullYear());
      }
      $('#timer_edit_repeat').prop('checked', d.repeat);
      $("#timer_edit_repeat_data").css("display", d.repeat ? "inline" : "none");
      var x = d.interval;
      var x1 = Math.floor(x / 10);
      var x2 = x - (x1 * 10);
      $('#timer_edit_repeat1').val(''+x1);
      $('#timer_edit_repeat2').val(''+x2);
      $('#timer_edit_repeat_unit').val(d.intervalunit);
       
      if (cb) cb();
    }
  });
}

function setTaskParams(cmd){
  if (!cmd) return;
  var data = getByProperty(ME.DATA.ctlapi.CTLDATA.cmd, 'id', cmd);
  json('../botmanager/read', 'db='+ME.DATA.db+'&id='+encodeURIComponent(data.java), function(result){
    var params = result.data.params;
    var timer = $('#timer_edit')[0].data;
    //console.log(JSON.stringify(params));
    var newhtml = '';
    if (!timer.params) timer.params = {};
    for (var i in params){
      var p = params[i];
      var v = timer.params[p.name];
      if (!v) v = "";
      if (p.type.indexOf('JSON') == 0) v = JSON.stringify(v);
      var id = 'cp_'+cmd+'_'+i;
      var type = p.type == 'int' || p.type == 'double' || p.type == 'float' ? 'number' : 'text';
      newhtml += "<label for='"+id+"'>"+p.type+' '+p.name+" = </label>";
      newhtml += "<input id='"+id+"' type='"+type+"' class='cp_"+cmd+"' value='"+v+"'><br>";
    }
    if (newhtml == '') newhtml = '<i>This command has no input parameters</i>';
    else newhtml = '<div>'+newhtml+'</div>';
    $('#timer_edit_params').html(newhtml)[0].data = result.data;
  });
}
me.setTaskParams = setTaskParams;

function adjustDaySelect(m, d, y){
    var mm = $('#'+m).val();
    var d1 = $('#'+d+'1').val();
    var d2 = $('#'+d+'2').val();
    var y = $('#'+y).val();
  
    var numdays = 31;
    while (true) try {
      var date = new Date(mm+' '+numdays+', '+y);
      if (date.getMonth() == ms.indexOf(mm)) break;
      numdays--;
    }
    catch (x) { numdays--; }
    
    var ds = Math.floor(numdays/10);
    buildDigitSelect(0, ds, "#"+d+"1");
    $('#'+d+'1').val(d1);
    d1 = $('#'+d+'1').val();
    
    buildDigitSelect(d1 == '0' ? 1 : 0, d1 == ''+ds ? numdays - (ds * 10) : 9, '#'+d+'2');
    $('#'+d+'2').val(d2);
}

function adjustMinuteSelect(h1, h2el){
  var val = $("#"+h2el).val();
  var stop = h1 == '0' ? 9 : 2;
  var start = h1 == '0' ? 1 : 0;
  buildDigitSelect(start, stop, "#"+h2el);
  $("#"+h2el).val(val);
}
