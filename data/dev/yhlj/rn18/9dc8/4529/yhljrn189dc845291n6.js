var me = this; 
var ME = $('#'+me.UUID)[0];

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  send_list(function(result){
    var el = $(ME).find('.repolist');
    var d = result.data;
    me.data = d.list;
    d.allowadd = true;
    d.disallowdelete = true;
    d.title = 'Installed Repositories';
    d.emptytext = "<i>No repositories found</i>";
    d.click_add = me.click_add;
    d.click_edit = me.click_edit;
    d.on_delete = me.save;
    installControl(el[0], "app", "list", function(api){
      me.list = api;
    }, d);
  });
  ui.initTooltips(ME);
};

me.click_add = function(){
  $(ME).find('.dialog-title').text('Import GitHub Repository');
  var d = {
    "selector": ".addrepopopup",
    "closeselector": ".close-add-dialog",
    "modal": true
  };
  me.ui.popup(d);
};

$(ME).find('.recommend').click(function(){
  var url = $(this).data('repourl');
  $(ME).find('#githuburl').val(url);
});

$(ME).find('.importgithubrepo').click(function(){
  var url = $(ME).find('#githuburl').val();
  me.ui.snackbarMsg("Installing from "+url, '600px');
  send_import(url, function(result){
    var msg = result.msg;
    if (msg.startsWith('OK')){
      var libid = msg.substring(4);
      window.location.href='../dev/index.html?lib='+libid;
    }
    else{
      me.ui.snackbarMsg(msg, '600px');
    }
  });
});
