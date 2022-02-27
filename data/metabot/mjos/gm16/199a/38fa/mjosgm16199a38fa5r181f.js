var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  json('../securitybot/listapps', null, function(result){
    document.body.securityapps = result.data;

    json('../metabot/apps', null, function(result){
      var el = $('#publish-tab')[0];
      if (el) el.api.setApps(result.data);
      me.data = result.data;
      sortApps();
      var listel = $(ME).find('.applist');
      for (var i in result.data.list){
        var app = result.data.list[i];
        app.installed = result.data.installed.indexOf(app.class) != -1 || result.data.installed.indexOf(app.pyclass) != -1;
        app.local = true;
        
        var args = { 
          "db": "metabot",
          "id": "appcard",
          "data": app
        };
        
        var claz = app.installed ? 'app-active' : app.local ? 'app-inactive' : 'app-remote';
        listel.append($('<div id="appcard_'+app.id+'" class="data-control app-card '+claz+'"/>').data('control', args));
      }
      updateFilters();
      activateControls(listel[0]);
      
      json('../peerbot/connections', null, function(result){
        me.peers = document.body.peers = result.data;
        var poplist = [];
        for (var i in result.data){
          var peer = result.data[i];
          if (peer.connected) poplist.push(peer);
        }
        
        function popnext(){
          if (poplist.length>0){
            scan(poplist.shift(), popnext);
          }
        }
        popnext();
        
      });
    });
  });
};

function sortApps(){
  me.data.list.sort(function(a,b) {return (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0);} ); 
}  

function scan(peer, cb){
  $.getJSON('../peerbot/remote/'+peer.id+'/metabot/apps', function(result){
    cb();
    me.peers[peer.id].apps = result.data;
    for (var i in result.data.list){
      var app = result.data.list[i];
      if (app.forsale){
        app.peers = [ peer ];
        var lapp = getByProperty(me.data.list, 'id', app.id);
        if (!lapp) {
          app.remote = true;
          me.data.list.push(app);
          lapp = app;

          sortApps();

          var args = { 
            "db": "metabot",
            "id": "appcard",
            "data": app
          };

          var n = me.data.list.indexOf(app);
          var listel = $(ME).find('.applist');
          var el = $('<div class="data-control app-card app-remote"/>')[0];
          $(listel.children()[n]).before(el);
          updateFilters();
          $(el).data('control', args);
          activateControl(el, function(){});
        }
        else if (!lapp.peers) lapp.peers = app.peers;
        else if (lapp.peers.indexOf(peer) == -1) {
          if (!lapp.available || Number(lapp.available)<Number(app.version))
            lapp.peers.unshift(peer);
          lapp.peers.push(peer);
        }

        if (!lapp.available) lapp.available = lapp.version;
        if (Number(lapp.available) < Number(app.version) && lapp.author == app.author) { 
          lapp.available = app.version;
          var card = $(ME).find('#appcard_'+app.id);
          card.find('.appupdatebutton').css('display', 'block'); //.click(function(){
//            setTimeout(function(){
//              card.find('.app-update-button').click();
//            }, 500);
//          });

          var name = lapp.name+' v'+lapp.version+' (v'+lapp.available+' available)';
          card.find('.appinfo-title').text(name);
          card.find('.app-card-image__filename').text(name);

        }
      }
    }
  });
}

function updateFilters(){
  $(ME).find('.app-active').animate({width:'228px',height:"228px"},500);
  
  var args = { inactive: $(ME).find('#appfilter-switch-1').prop('checked'), remote: $(ME).find('#appfilter-switch-2').prop('checked') }
  if (args.inactive){
    $(ME).find('.app-inactive').animate({width:'228px',height:"228px"},500);
  }
  else{
    $(ME).find('.app-inactive').animate({width:'0px',height:"0px"},500);
  }

  if (args.remote){
    $(ME).find('.app-remote').animate({width:'228px',height:"228px"},500);
  }
  else{
    $(ME).find('.app-remote').animate({width:'0px',height:"0px"},500);
  }

  if (!me.filters || args.inactive != me.filters.inactive || args.remote != me.filters.remote){
    me.filters = args;
    json('../botmanager/newdb', 'db=runtime', function(result){
      json('../botmanager/write', 'db=runtime&id=metabot_applist_filters&data='+encodeURIComponent(JSON.stringify(args)), function(result){});
    });
  }
}

$(ME).find('.switch-input').change(updateFilters);

json('../botmanager/read', 'db=runtime&id=metabot_applist_filters', function(result){
  if (result.data){
    me.filters = result.data;
    var x = $(ME).find('#appfilter-switch-1').prop('checked', result.data.inactive).parent()[0]; 
    var y = $(ME).find('#appfilter-switch-2').prop('checked', result.data.remote).parent()[0];
    if (x.MaterialSwitch) x.MaterialSwitch.checkToggleState();
    if (y.MaterialSwitch) y.MaterialSwitch.checkToggleState();
  }
});

