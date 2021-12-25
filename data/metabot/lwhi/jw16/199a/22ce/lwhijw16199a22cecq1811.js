var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  
//  componentHandler.upgradeElement($(ME).find('.peerselect')[0]);
  
//  var elid = guid();
//  $(ME).find('.peerselect')[0].id = elid;
  
//  getmdlSelect.init("#"+elid);
  
  var app = me.app = ME.DATA.data;
  var title = app.name+' v'+app.version+(app.remote ? ' (available)' : !app.installed ? ' (inactive)' : '');
  var src = app.installed ||  !app.peers || !app.peers[0] ? app.img : '../peerbot/remote/'+app.peers[0].id+app.img;
  
  $(ME).find('.app-card-square.mdl-card').css('background', 'url("'+src+'") center / cover');
  $(ME).find('.app-card-image__filename').html(title);
  $(ME).find('.appinfo-title').html(title);
  $(ME).find('.appinfo-ctlid').html(app.id);
  $(ME).find('.appinfo-author').html(app.authorname+' ('+app.author+')');
  $(ME).find('.appinfo-desc').html(app.desc);

  $(ME).find('.appinfo-img').prop('src', src);
  
  if (app.remote) $(ME).find('.app-card-square > .mdl-card__actions').css('background-color', '#84bd0088');
  else if (!app.installed) $(ME).find('.app-card-square > .mdl-card__actions').css('background-color', '#00000088');

  if (!app.remote) {
    installControl($(ME).find('.appinfo-api')[0], 'botmanager', 'api', function(result){}, {appid:app.id});
  }
  
  $(ME).find('.app-card-square').click(function(){
    
    var list = [];
    for (var i in app.peers) {
      var p = app.peers[i];
      var a = getByProperty(p.apps.list, 'id', app.id);
      var o = { id:p.id, name: 'v'+a.version+' - '+p.name+' ('+p.id+')'};
      list.push(o);
    }
    if (!app.local || (app.local && Number(app.version) < Number(app.available))) 
      installControl($(ME).find('.injectselect')[0], 'metabot', 'select', function(){}, { label:'Download from peer', list: list });
    
    $(ME).find('.app-install-button').css('display', !app.local ? 'inline-block' : 'none');
    $(ME).find('.app-run-button').css('display', app.installed ? 'inline-block' : 'none');
    $(ME).find('.app-deactivate-button').css('display', app.installed ? 'inline-block' : 'none');
    $(ME).find('.app-edit-button').css('display', app.local ? 'inline-block' : 'none');
    $(ME).find('.app-activate-button').css('display', app.local && !app.installed ? 'inline-block' : 'none');
    $(ME).find('.app-uninstall-button').css('display', app.local && !app.installed ? 'inline-block' : 'none');
    $(ME).find('.app-update-button').css('display', app.local && Number(app.version) < Number(app.available) ? 'inline-block' : 'none');
    
    var x = $('body').width()-100;
    var y = $('body').height()-210;
    var w = $(ME).width();
    var h = $(ME).height();
    var x2 = $(ME).offset().left;
    var y2 = $(ME).offset().top;
    $(ME).find('.greyout').css('display', 'block');
    $(ME).find('.app-detail').css('top', y2+'px').css('left', x2+'px').css('width', w+'px').css('height', h+'px').css('display', 'block').animate({top:"160px", width:x+"px", height:y+"px", left:"50px"}, 500);;
    
    $(ME).find('.appinfo-close').click(function(){
      var x = $(ME).offset().left;
      var y = $(ME).offset().top;
      var w = $(ME).width();
      var h = $(ME).height();
      $(ME).find('.app-detail').animate({top:y+"px", width:w+"px", height:h+"px", left:x+"px"}, 500, function(){
        $(this).css('display', 'none');
        $(ME).find('.greyout').css('display', 'none');
      });;
    });
    
  });

  $(ME).find('.app-run-button').click(function(){ window.location.href='../'+app.id+'/'+app.index; });
  $(ME).find('.app-edit-button').click(function(){ window.location.href='../metabot/editcontrol.html?db='+app.control.db+'&id='+app.control.id; });
  
  $(ME).find('.app-deactivate-button').click(function(){ 
    json('../metabot/deactivate', 'classname='+encodeURIComponent(app.class), function(result){
      $(ME).find('.restartarea').css('display', 'block');
    });
  });  
  
  $(ME).find('.app-activate-button').click(function(){ 
    json('../metabot/activate', 'classname='+encodeURIComponent(app.class), function(result){
      $(ME).find('.restartarea').css('display', 'block');
    });
  });  
  
  $(ME).find('.app-uninstall-button').click(function(){ 
    json('../metabot/uninstall', 'appid='+encodeURIComponent(app.id), function(result){
      window.location.href = window.location.href;
    });
  });  
  
  $(ME).find('.app-update-button').click(function(){ 
    var sel = $(ME).find('.mdl-selectfield__select');
    app.selectedpeer = document.body.peers[sel.val()];
    $(ME).find('.mdl-selectfield__select').change(function(){
      app.selectedpeer = document.body.peers[sel.val()];
    });
    
    $('.appactions').css('display', 'none');
    
    app.cb = function(){
      $(ME).find('.app-update-button').css('display', 'none');
      $(ME).find('.restartarea').css('display', 'block');
      $(ME).find('.injectselect').html('');
    };
    
    installControl($(ME).find('.installarea')[0], 'metabot', 'installapp', function(api){}, app);
  });
  
  $(ME).find('.app-install-button').click(function(){ 
    app.selectedpeer = document.body.peers[$(ME).find('.mdl-selectfield__select').val()];
    $(ME).find('.mdl-selectfield__select').change(function(){
      app.selectedpeer = document.body.peers[sel.val()];
    });
    
    
    $('.appactions').css('display', 'none');
    
    app.cb = function(){
      $(ME).find('.app-install-button').css('display', 'none');
//      $(ME).find('.restartarea').css('display', 'block');
      $(ME).find('.injectselect').html('');
      $(ME).find('.app-activate-button').click();
    };
    
    installControl($(ME).find('.installarea')[0], 'metabot', 'installapp', function(api){}, app);
  });
  
};

$(window).resize(function(){
  var x = $('body').width()-100;
  var y = $('body').height()-210;

  $(ME).find('.app-detail').css('width', x+'px').css('height', y+'px');
});