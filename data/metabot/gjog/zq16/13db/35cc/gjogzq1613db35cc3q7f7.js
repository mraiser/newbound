var me = this;
var ME = $('#'+me.UUID)[0];

var app = ME.DATA;

me.ready = function(){
  $(ME).find('.ctlid').text(app.id);
  $(ME).find('.author').text(app.authorname+' ('+ME.DATA.author+')');
  $(ME).find('.mdc-card__supporting-text').html(app.desc);
  if (!app.remote) {
    installControl($(ME).find('.api')[0], 'botmanager', 'api', function(result){}, {appid:app.id});
  }

  var isactive = app.isactive;
  var isupdate = app.isupdate;
  var isremote = app.remote;
  
  if (isupdate || isremote) {
    var newhtml = '<div class="mdc-select"><div class="mdc-select-title">select a peer to download from</div><select class="mdc-select__surface">';
    for (var i in app.peers){
      var p = app.peers[i];
      var v = getByProperty(p.apps.list, 'id', app.id).version;
      newhtml += '<option value="'+p.id+'">v'+v+' - '+p.name+' ('+p.id+')</option>';
    }
    newhtml += '</select><div class="mdc-select__bottom-line"></div></div>';
    $(ME).find('.peerselect').html(newhtml);
  }
  
  $(ME).find('.runbutton').css('display', isactive ? 'inline-block' : 'none').click(function(){
    window.location.href = '../'+app.id+'/'+app.index;
  });
  
  $(ME).find('.editbutton').css('display', !isremote ? 'inline-block' : 'none').click(function(){
    window.location.href = '../metabot/editcontrol.html?db='+app.control.db+'&id='+app.control.id;
  });
  
  $(ME).find('.deactivatebutton').css('display', isactive ? 'inline-block' : 'none').click(function(){
    json('../metabot/deactivate', 'classname='+encodeURIComponent(app.class), function(result){
      window.location.href = window.location.href;
    });
  });
  
  $(ME).find('.activatebutton').css('display', !isactive && !isremote ? 'inline-block' : 'none').click(function(){
    json('../metabot/activate', 'classname='+encodeURIComponent(app.class), function(result){
      window.location.href = window.location.href;
    });
  });
  
  $(ME).find('.uninstallbutton').css('display', !isactive && !isremote ? 'inline-block' : 'none').click(function(){
    json('../metabot/uninstall', 'appid='+encodeURIComponent(app.id), function(result){
      window.location.href = window.location.href;
    });
  });
  
  $(ME).find('.installbutton').css('display', isremote ? 'inline-block' : 'none').click(function(e){
    var el = $(e.target).closest('.installbutton');
    el.blur().unbind('click').css('z-index', '5'); //.html('<span class="mdc-fab__icon">get_app</span>').animate({'border-radius':'40px','width':'80px','height':'80px','margin-top':'-30px'}, 1000);
    var card = el.closest('.appcard');
    
    var wo = card.find('.whiteout');
    wo.css('opacity', '0').css('display', 'block').animate({opacity:'0.5'}, 1000);

    var holder = card.find('.installdiv');
    holder.css('z-index', '4').width(($(ME).width()*0.9)-200);

    app.cb = function(){
      app.version = app.available;
      card.find('.appversion').text('v'+app.version);
      wo.animate({opacity:'0'}, 1000, function(){
        wo.css('display', 'none');
      });
      el.animate({'width': '0px', 'height':'0px'}, 1000, function(){
        el.remove();
      });
      card.find('.peerselect').animate({'opacity': '0'}, 1000, function(){
        card.find('.peerselect').remove();
      });
      var rbut = card.find('.api')[0];
      installControl(rbut, 'metabot', 'restartbutton', function(result){
        $(rbut).find('button').addClass('mdc-button mdc-button--raised dark');
      }, app);
    };
    
    installControl(holder[0], 'metabot', 'installapp', function(api){}, app);
  });
  
  
  
  

  
  
};

