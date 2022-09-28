var me = this;
var ME = $('#'+me.UUID)[0];

var ms = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];

me.ready = function(){
  var data = ME.DATA.timer;
  var id = ME.DATA.timer.id;
  var lib = ME.DATA.data.lib;
  $('.timer_edit_name').text(data.name);
  
  $('#timer_edit')[0].uuid = id;
  $('.timer_edit_name').text(data.name);
  
  var newhtml = ''
  for (var i in ME.DATA.ctlapi.CTLDATA.cmd){
    var c = ME.DATA.ctlapi.CTLDATA.cmd[i];
    newhtml += '<option value="'+c.id+'">'+c.name+'</option>';
  }
  $('#timer_edit_task').html(newhtml);
  
  buildDigitSelect(0, 2, '.h1select');
  buildDigitSelect(0, 5, '.m1select');
  buildDigitSelect(0, 3, '.d1select');
  buildDigitSelect(0, 9, '.digitselect');
  var thisyear = new Date().getFullYear();
  buildDigitSelect(thisyear, thisyear+10, '.yearselect');
  
  var units = '';
  var tus = [ 'milliseconds', 'seconds', 'minutes', 'hours', 'days' ];
  i = tus.length;
  while (i-->0) units = '<option>'+tus[i]+'</option>' + units;
  $('.timeunitselect').html(units);
  
  var months = '';
  i = ms.length;
  while (i-->0) months = '<option>'+ms[i]+'</option>' + months;
  $('.monthselect').html(months);
  
  json('../app/read', 'lib='+lib+'&id='+id, function(result) {
    var data = me.data = result.data;
    $('#timer_edit')[0].data = data;
    $('#timer_edit_task').val(data.cmd);
    if (data.start) {
      if (data.start>99){
        $(ME).find('#timer_edit_start-3').prop('checked', true);
        var d = new Date(data.start);
        setTime(d);
      }
      else {
        var d = new Date();
        setTime(d);
        if (data.start>0){
          $(ME).find('#timer_edit_start-2').prop('checked', true);
          var t1 = Math.floor(data.start/10);
          var t2 = data.start % 10;
          $(ME).find('#tes2-1').val(t1);
          $(ME).find('#tes2-2').val(t2);
          $(ME).find('#tes2-unit').val(data.startunit);
        }
      }
    }
    if (data.repeat) {
      $(ME).find('#timer_edit_repeat').prop('checked',true);
      $(ME).find('#timer_edit_repeat_data').css('display', 'block');
      var t1 = Math.floor(data.interval/10);
      var t2 = data.interval % 10;
      $(ME).find('#timer_edit_repeat1').val(t1);
      $(ME).find('#timer_edit_repeat2').val(t2);
      $(ME).find('#timer_edit_repeat_unit').val(data.intervalunit);
    }
  });
};

function setTime(d){
  var hour = d.getHours();
  var h1 = Math.floor(hour/10);
  var h2 = hour % 10;
  var minute = d.getMinutes();
  var m1 = Math.floor(minute/10);
  var m2 = minute % 10;
  var month = d.getMonth();
  var day = d.getDate();
  var d1 = Math.floor(day/10);
  var d2 = day % 10;
  var year = d.getYear()+1900;
  $(ME).find('#tes3-h1').val(h1);
  $(ME).find('#tes3-h2').val(h2);
  $(ME).find('#tes3-m1').val(m1);
  $(ME).find('#tes3-m2').val(m2);
  $(ME).find('#tes3-m').val(ms[month]);
  $(ME).find('#tes3-d1').val(d1);
  $(ME).find('#tes3-d2').val(d2);
  $(ME).find('#tes3-y').val(year);
}

function buildDigitSelect(start, stop, el){
  var digits = '';
  var i = stop+1;
  while (i-->start) digits = '<option>'+i+'</option>' + digits;
  $(el).html(digits);
}

$(ME).find('#timer_edit_repeat').click(function(){
  var which = $(this).prop('checked') ? 'block' : 'none';
  $(ME).find('#timer_edit_repeat_data').css('display', which);
});

function saveTimer(){
  var lib = ME.DATA.lib;
  var data = $('#timer_edit')[0].data;
  var uuid = $('#timer_edit')[0].uuid;
  data.cmd = $('#timer_edit_task').val();
  data.cmddb = lib;
  data.cmdlib = lib;
  data.params = {};

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
    debugger;
    data.startunit = 'milliseconds';
  }
  
  data.repeat = $('#timer_edit_repeat').prop('checked');
  
  var d1 = $('#timer_edit_repeat1').val();
  var d2 = $('#timer_edit_repeat2').val();
  data.interval = parseInt(d1)*10 + parseInt(d2);
  data.intervalunit = $('#timer_edit_repeat_unit').val();

  json('../app/timeron', 'data='+encodeURIComponent(JSON.stringify(data))+'&id='+encodeURIComponent(uuid), function(result){
    if (result.status != 'ok') alert(result.msg);
    else json('../app/write', 'lib='+lib+'&data='+encodeURIComponent(JSON.stringify(data))+'&id='+encodeURIComponent(uuid), function(result){
      if (result.status != 'ok') alert(result.msg);
      else $('#cancelthetimerbutton').click();
    });
  });
}
$('#savethetimerbutton').click(saveTimer);

function extractTimerStart(){
  var h = $('#tes3-h1').val()+''+$('#tes3-h2').val();
  var m = $('#tes3-m1').val()+''+$('#tes3-m2').val();
  //    var a = $('#tes3-ampm').val();

  var mm = $('#tes3-m').val();
  var dd = $('#tes3-d1').val()+''+$('#tes3-d2').val();
  var y = $('#tes3-y').val();

  return mm+" "+dd+", "+y+" "+h+":"+m; //+" "+a;
}

function deleteTimer(e){
  var uuid = $('#timer_edit')[0].uuid;
  var data = {
    title:'Delete Timer',
    text:'Are you sure you want to delete this timer? This cannot be undone.',
    "clientX":e.clientX,
    "clientY":e.clientY,
    cancel:'cancel',
    ok:'delete',
    cb: function(){
      json('../app/timeroff', 'id='+encodeURIComponent(uuid), function(result){
        if (result.status != 'ok') alert(result.msg);
        else json('../app/delete', 'lib='+ME.DATA.data.lib+'&id='+encodeURIComponent(uuid), function(result){
          var d = getByProperty(ME.DATA.ctlapi.CTLDATA.timer, 'id', uuid);
          var i = ME.DATA.ctlapi.CTLDATA.timer.indexOf(d);
          ME.DATA.ctlapi.CTLDATA.timer.splice(i,1);
          ME.DATA.ctlapi.saveControl();
          ME.DATA.ctlapi.buildTimerList();
          closeTimer();
        });
      });
    }
  };
  document.body.api.ui.confirm(data);
}
$('#deletethetimerbutton').click(deleteTimer);

function closeTimer(){
  $('.api-main').css('display', 'block');
  $('.api-edittimer').css('display', 'none');
}
$('#cancelthetimerbutton').click(closeTimer);
