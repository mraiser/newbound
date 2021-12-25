var me = this;
var ME = $('#'+me.UUID)[0];

var data = ME.DATA; //$(ME).data('control');
  console.log(data);
$('#publishappname').text('Publish '+data.name);
var hold = data.ctl;
    
me.ready = function(){    
//  componentHandler.upgradeAllRegistered();
  send_appdata(data, function(result){
    console.log(result);
  //  installControl('#publishappfieldset', 'taskbot', 'fieldset', function(result){}, result.data);
    var d = me.properties = result.data;
    d.ctlid = data.ctl;

    if (!d.desc || d.desc == '') d.desc = $('#ov_desc').val();
    else if (!d.subtitle || d.subtitle == '') d.subtitle = $('#ov_desc').val();

    $('#publishappname').text('Publish '+d.name+' ('+d.ctlid+')');
    $('#pa_name').val(d.name)[0].oval = d.name;
    $('#pa_libraries').val(d.libraries);
    $('#pa_index').val(d.index);
    $('#pa_img').val(d.img);
    $('#pa_class').val(d.botclass);  
    $('#pa_desc').val(d.desc);  
    $('#pa_video').val(d.video);  
    $('#pa_detail').val(d.detail);  
    $('#pa_subtitle').val(d.subtitle);  
    $('#pa_forsale').prop('checked', d.forsale == 'true');  

    if (d.generate)
    {
      $('#pa_genhtml').prop('checked', d.generate.indexOf("html") != -1);
      $('#pa_genjava').prop('checked', d.generate.indexOf("java") != -1);
    }

    componentHandler.upgradeAllRegistered();
  });

  me.deleteControl = function(ctldb, ctlid){
    json('../botmanager/read', 'db='+ctldb+'&id=controls', function(result){
      var list = result.data.list;
      var i = list.indexOf(getByProperty(list, "id", ctlid));
      list.splice(i,1);
      json('../botmanager/write', 'db='+ctldb+'&id=controls&data='+encodeURIComponent(JSON.stringify(result.data)), function(result){
        json('../botmanager/delete', 'db='+encodeURIComponent(ctldb)+'&id='+encodeURIComponent(ctlid), function(result){
          $('.menubuttonback').click();
        });
      });
    });
  };
};

$('#deletethiscontrol').click(function(){
  if (confirm("Are you really sure you want to permanently delete this control?")) $('.publish')[0].api.deleteControl(me.properties.ctldb, me.properties.ctlid);
});

$('#pa_publishtheappnow').click(function(){
  $('#pa_msg').html('<i>Saving app properties...</i>');
  var d = updateProps();
  send_save(d, function(result){
    if (result.status != 'ok') $('#pa_msg').html('<font color="red">ERROR: '+result.msg+'</font>');
    else {
      $('#pa_msg').html('Checking status of libraries...');
      send_status(d.libraries, function(result){
        function whenDone(){
          $('#pa_msg').html('Publishing app '+d.name);
          send_publishapp(d.id, function(result){
            if (result.status != 'ok') $('#pa_msg').html('<font color="red">ERROR: '+result.msg+'</font>');
            else {
              $('#pa_msg').html('The app has been published. You may need to restart services to see changes.');
              setTimeout("$('#pa_msg').html('');", 5000);
            }
          });
        }
        
        function popNext(){
          if (result.data.libraries.length == 0) whenDone();
          else {
            var rdl = result.data.libraries.pop();
            if (rdl.dirty){
              $('#pa_msg').html('Publishing library: '+rdl.id);
              send_publishlib(rdl.id, function(result){
                if (result.status != 'ok') $('#pa_msg').html('<font color="red">ERROR: '+result.msg+'</font>');
                else {
                  $('#pa_msg').html('Library '+rdl.id+' has been published');
                  popNext();
                }
              });
            }
            else popNext();
          }
        }
        
        popNext();
      });
    }
  });
});

function updateProps(){
  var d = me.properties;
  d.name = $('#pa_name').val();
  d.libraries = $('#pa_libraries').val();
  d.index = $('#pa_index').val();
  d.img = $('#pa_img').val();
  d.botclass = $('#pa_class').val();
  d.desc = $('#pa_desc').val();
  d.video = $('#pa_video').val();
  d.detail = $('#pa_detail').val();
  d.subtitle = $('#pa_subtitle').val();
  d.forsale = $('#pa_forsale').prop('checked') ? 'true' : 'false';
  
  var a = $('#pa_genhtml').prop('checked');
  var b = $('#pa_genjava').prop('checked');
  
  d.generate = a && b ? 'html,java' : a ? 'html' : b ? 'java' : '';
  
  return d;
}

$('#pa_saveprops').click(function(){
  var d = updateProps();
  send_save(d, function(result){
    if (result.status == 'ok') $('#pa_msg').html('Your app has been saved.');
    else $('#pa_msg').html('<font color="red">ERROR: '+result.msg+'</font>');
    setTimeout("$('#pa_msg').html('');", 5000);
  });
});  

function updateNames(){
  var oval = this.oval;
  console.log(oval);
  var v = this.oval = $(this).val();
  
  $('#publishappname').text('Publish '+v);
  if ($('#pa_desc').val() == 'The '+oval+' application') $('#pa_desc').val('The '+v+' application');
  if ($('#pa_class').val() == 'com.newbound.robot.published.'+oval) $('#pa_class').val('com.newbound.robot.published.'+v);
}

$('#pa_name').change(updateNames);
$('#pa_name').keyup(updateNames);
