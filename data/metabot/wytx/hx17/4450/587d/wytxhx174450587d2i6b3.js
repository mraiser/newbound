var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var newhtml = ''
  for (var i in ME.DATA.ctlapi.CTLDATA.cmd){
    var c = ME.DATA.ctlapi.CTLDATA.cmd[i];
    newhtml += '<option value="'+c.id+'">'+c.name+'</option>';
  }

  $('#event_edit_task').html(newhtml);
  
  editEvent(ME.DATA.event.id);
  $(ME).find('.selectedevent').change(function(){
    var d = $('#event_edit')[0].data;
    d.event = $(ME).find('.selectedevent').val();
  });
};

function selectApp(val){
  json('../botmanager/events', 'id='+val, function(result){
    if (result.list){
      var d = $('#event_edit')[0].data;
      var newhtml = "<select class='eventpicker'>";
      for (var i in result.list){
        var name = result.list[i];
        var issel = d.event == name ? " selected" : "";
        newhtml += "<option value='"+name+"'"+issel+">"+name+"</option>";
      }
      newhtml += "</select>";
      $(ME).find('.eventselect').html(newhtml);
      var newval = $(ME).find('.eventpicker').val();
      if (val != d.bot){
        $(ME).find('.selectedevent').val(newval);
        d.bot = val;
        d.event = newval;
      }
      $(ME).find('.eventpicker').change(function(){
        var newval = $(ME).find('.eventpicker').val();
        $(ME).find('.selectedevent').val(newval);
        d.event = newval;
      });
    }
  });
}

function editEvent(id, cb){
  $('#event_edit_msg').html('');
  var data = ME.DATA.event;
  $('.event_edit_name').text(data.name);
  $('#event_edit')[0].uuid = id;
  json('../botmanager/read', 'db='+ME.DATA.db+'&id='+encodeURIComponent(id), function(result){
    if (result.status != 'ok') error(result.msg, 'event_edit_msg');
    else {
      var d = result.data;
      $('#event_edit')[0].data = d;
      if (d.cmd) $('#event_edit_task').val(d.cmd);
      if (!d.bot) {
        d.bot = "botmanager";
        d.event = "write"
      }
      $(ME).find('.selectedevent').val(d.event);
      
      var dd = {
        "label": "On Event:",
        "value": d.bot,
        "cb": selectApp
      };
      var el = $(ME).find('.eventappselect')[0];
      installControl(el, "metabot", "appselect", function(api){
        selectApp(d.bot);
      }, dd);
      
      if (cb) cb();
    }
  });
}

function deleteEvent(){
  var uuid = $('#event_edit')[0].uuid;
  if (confirm('Are you sure you want to delete this event? This cannot be undone.')) json('../botmanager/event', 'mode=kill&id='+encodeURIComponent(uuid), function(result){
    if (result.status != 'ok') alert(result.msg);
    else 
      json('../botmanager/delete', 'db='+ME.DATA.db+'&id='+encodeURIComponent(uuid), function(result){
      var d = getByProperty(ME.DATA.ctlapi.CTLDATA.event, 'id', uuid);
      var i = ME.DATA.ctlapi.CTLDATA.event.indexOf(d);
      ME.DATA.ctlapi.CTLDATA.event.splice(i,1);
      ME.DATA.ctlapi.saveControl();
      ME.DATA.ctlapi.buildEventList();
      closeEvent();
    });
  });
}
$('#deletetheeventbutton').click(deleteEvent);

function closeEvent(){
  $('.api-main').css('display', 'block');
  $('.api-editevent').css('display', 'none');
}
$('#canceltheeventbutton').click(closeEvent);


function saveEvent(){
  var DB = ME.DATA.db;
  var data = $('#event_edit')[0].data;
  var uuid = $('#event_edit')[0].uuid;
  data.cmd = $('#event_edit_task').val();
  data.cmddb = DB;

  json('../botmanager/event', 'mode=set&params='+encodeURIComponent(JSON.stringify(data))+'&id='+encodeURIComponent(uuid), function(result){
    if (result.status != 'ok') alert(result.msg);
    else 
      json('../botmanager/write', 'db='+DB+'&data='+encodeURIComponent(JSON.stringify(data))+'&id='+encodeURIComponent(uuid), function(result){
      if (result.status != 'ok') alert(result.msg);
      else $('#canceltheeventbutton').click();
    });
  });
}
$('#savetheeventbutton').click(saveEvent);
