var me = this; 
var ME = $('#'+me.UUID)[0];

me.uiReady = function(ui){
  me.ui = ui;
  ui.initPopups(ME);
  $(ME).find('.wrap').css('display', 'block');
  me.build();
};

me.build = function(cb) {
  json('../app/libs', null, function(result){
    if (result.status != "ok") alert(result.msg);
    else {
      var libs = me.list = result.data;
      libs.sort((a, b) => (a.id > b.id) ? 1 : -1);
      var newhtml = '<table class="libstable tablelist">';
//      newhtml += '<thead><tr><th>Library</th></tr></thead>';
      newhtml += '<tbody class="publish-liblist">';
      for (var i in libs){
        var lib = libs[i];
        if (lib.id) {
          newhtml += '<tr data-lib="'+lib.id+'" class="publibid">'
            + '<td>'
            + lib.id
            + '</td></tr>';
        }
        else console.log(lib);
      }
      newhtml += '</tbody></table>';
      $(ME).find(".liblist").html(newhtml).find('.publibid').click(function(){
        var lib = getByProperty(me.list, "id", $(this).data("lib"));
        var el = $(ME).find('.scrollme2');
        installControl(el[0], 'dev', 'libinfo', function(api){}, lib);
      });
      
      var lib = getQueryParameter('lib');
      if (lib && lib != 'null') { // FIXME - WTF?
        lib = getByProperty(me.list, "id", lib);
        var el = $(ME).find('.scrollme2');
        installControl(el[0], 'dev', 'libinfo', function(api){}, lib);
        var loc = window.location.href;
        var i = loc.indexOf('?');
        loc = loc.substring(0,i);
        window.history.pushState(lib, "Libraries", loc);
      }
      
      if (cb) cb();
    }
  });
};

$(ME).find('.addlibrarybutton').click(function(e){
  var data = {
    title:'New Library',
    text:'New library name',
    subtext:'lowercase letters, numbers, and underscores only.',
    clientX:e.clientX,
    clientY:e.clientY,
    cancel:'cancel',
    ok:'create',
    validate:function(val){
      if (val.length == 0) {
        document.body.api.ui.snackbar({"message": "Invalid characters"});
        return false;
      }
      var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';
      var i = val.length;
      while (i-->0) if (validchars.indexOf(val.charAt(i)) == -1) {
        document.body.api.ui.snackbar({"message": "Invalid characters"});
        return false;
      }
      return true;
    },
    cb: function(val){
      json('../app/newlib', 'lib='+encodeURIComponent(val)+'&writers=[]&readers='+encodeURIComponent(JSON.stringify(["anonymous"])), function(result){
        me.build(function(){
          var lib = getByProperty(me.list, 'id', val);
          installControl($(ME).find('.scrollme2')[0], 'dev', 'libinfo', function(){}, lib);
        });
      });
    }
  };
  document.body.api.ui.prompt(data);
});

$(ME).find('.open-library-settings').click(function(){
  json('../app/read', 'lib=runtime&id=metaidentity', function(result){
    if (result.status != 'ok' && result.msg == 'No such database') {
      json('../app/newlib', 'lib=runtime', load);
    }
    else {
      var data = result.data;
      if (!data) data = { 'displayname':'Some Dev', organization:'' };
      
      $('#devname').val(data.displayname);
      $('#devorg').val(data.organization);
      
      json('../app/deviceid', null, function(result){
        $('#editidentityuuid').text(result.msg);
        document.body.MYUUID = result.msg;
      });
    }
  });
});

$('#savemyidentity').click(function(){
  var data = { 'displayname':$('#devname').val(), organization:$('#devorg').val() };
  json('../app/write', 'readers=[]&writers=[]&lib=runtime&id=metaidentity&data='+encodeURIComponent(JSON.stringify(data)), function(result){
    if (result.status != 'ok') alert('ERROR: '+result.msg);
  });
});
