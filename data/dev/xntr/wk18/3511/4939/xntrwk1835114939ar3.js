var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var data = ME.DATA.event;
  var id = ME.DATA.event.id;
  $('#event_edit')[0].uuid = id;
  $('.event_edit_name').text(data.name);
  
  var newhtml = ''
  for (var i in ME.DATA.ctlapi.CTLDATA.cmd){
    var c = ME.DATA.ctlapi.CTLDATA.cmd[i];
    newhtml += '<option value="'+c.id+'">'+c.name+'</option>';
  }
  $('#event_edit_task').html(newhtml);
  
  json('../app/read', 'lib='+ME.DATA.lib+'&id='+encodeURIComponent(id), function(result){
    if (result.status != 'ok') alert(result.msg);
    else {
      var d = result.data;
      $('#event_edit')[0].data = d;
      if (d.cmd) $('#event_edit_task').val(d.cmd);
      if (!d.bot) {
        d.bot = "app";
        d.event = "HTTP_BEGIN"
      }

      json('../app/apps', null, function(result){
        result.data.sort((a, b) => (a.name > b.name) ? 1 : -1);
        var newhtml = '';
        for (var i in result.data) {
          var rdi = result.data[i];
          var issel = rdi.id == d.bot ? ' selected' : '';
          //if (rdi.active) 
            newhtml += '<option value="'+rdi.id+'"'+issel+'>'+rdi.name+'</option>';
        }
        $('#eventappselect').html(newhtml).change(function(){
          var bot = d.bot = $('#eventappselect').val();
          selectApp(bot);
        });

        var bot = d.bot = $('#eventappselect').val();
        selectApp(bot);
      });
    }
  });
};

$(ME).find('#deletetheeventbutton').click(function(e){ 
  var uuid = $('#event_edit')[0].uuid;
  var data = {
    title:'Delete Event Listener',
    text:'Are you sure you want to delete this event listener? This cannot be undone.',
    "clientX":e.clientX,
    "clientY":e.clientY,
    cancel:'cancel',
    ok:'delete',
    cb: function(){
      json('../app/eventoff', 'lib='+ME.DATA.lib+'&id='+encodeURIComponent(uuid), function(result){
        if (result.status != 'ok') {
          alert(result.msg);
        }
        else {
          json('../app/delete', 'lib='+ME.DATA.lib+'&id='+encodeURIComponent(uuid), function(result){
            var d = getByProperty(ME.DATA.ctlapi.CTLDATA.event, 'id', uuid);
            var i = ME.DATA.ctlapi.CTLDATA.event.indexOf(d);
            ME.DATA.ctlapi.CTLDATA.event.splice(i,1);
            ME.DATA.ctlapi.saveControl();
            ME.DATA.ctlapi.buildEventList();
            closeEvent();
          });
        }
      });
    }
  };
  document.body.api.ui.confirm(data);
});

function selectApp(bot) {
  json('../app/events', "app="+bot, function(result){
    result.data.sort();
    var d = $('#event_edit')[0].data;
    var newhtml = "<select class='eventpicker'>";
    for (var i in result.data){
      var name = result.data[i];
      var issel = d.event == name ? " selected" : "";
      newhtml += "<option value='"+name+"'"+issel+">"+name+"</option>";
    }
    newhtml += "</select>";
    $(ME).find('.eventselect').html(newhtml).find('.eventpicker').change(function(){
      d.event = $(this).val();
      $(ME).find('.selectedevent').val(d.event);
    });
    d.event = $(ME).find('.eventpicker').val();
    $(ME).find('.selectedevent').val(d.event);
  });
}

function closeEvent(){
  $('.api-main').css('display', 'block');
  $('.api-editevent').css('display', 'none');
}
$('#canceltheeventbutton').click(closeEvent);

function saveEvent(){
  var lib = ME.DATA.lib;
  var data = $('#event_edit')[0].data;
  var uuid = $('#event_edit')[0].uuid;
  data.cmd = $('#event_edit_task').val();
  data.cmddb = lib;

  json('../app/write', 'lib='+lib+'&data='+encodeURIComponent(JSON.stringify(data))+'&id='+encodeURIComponent(uuid), function(result){
    if (result.status != 'ok') alert(result.msg);
    else {
      json('../app/eventon', 
           'id='+encodeURIComponent(uuid)
           +'&app='+encodeURIComponent(data.bot)
           +'&event='+encodeURIComponent(data.event)
           +'&cmdlib='+encodeURIComponent(lib)
           +'&cmdid='+encodeURIComponent(data.cmd), function(result){
        if (result.status != 'ok') alert(result.msg);
        else $('#canceltheeventbutton').click();
      });
    }
  });
}
$('#savetheeventbutton').click(saveEvent);