var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  componentHandler.upgradeAllRegistered();
  load();
};

$('#savemyidentity').click(function(){
  var data = { 'displayname':$('#devname').val(), organization:$('#devorg').val() };
  json('../botmanager/write', 'db=runtime&id=metaidentity&data='+encodeURIComponent(JSON.stringify(data)), function(result){
    if (result.status != 'ok') $('#savemyidentitymsg').html('<font color="red">ERROR: '+result.msg+'</font>');
    else {
      $('#savemyidentitymsg').html('Your profile has been saved.');
      setTimeout("$('#savemyidentitymsg').html('&nbsp;');", 5000);
    }
  });
});

function load(){
  json('../botmanager/read', 'db=runtime&id=metaidentity', function(result){
    if (result.status != 'ok' && result.msg == 'No such database') {
      json('../botmanager/newdb', 'db=runtime', load);
    }
    else {
      var data = result.data;
      if (!data) data = { 'displayname':'Some Dev', organization:'' };
      
      $('#devname').val(data.displayname).parent()[0].MaterialTextfield.init();
      $('#devorg').val(data.organization).parent()[0].MaterialTextfield.init();
      
      json('../peerbot/getpeerid', null, function(result){
        $('#editidentityuuid').text(result.msg);
        document.body.MYUUID = result.msg;
      });
    }
  });
}
$(ME).find('.cancelbutton').click(load);