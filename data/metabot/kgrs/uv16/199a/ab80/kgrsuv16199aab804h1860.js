var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  json('../metabot/libraries', null, function(result){
      if (result.data.data) result.data = result.data.data;
      result.data.list.sort(function(a,b) {return (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0);} ); 
      document.body.libraries = result.data.list;
      me.build(result.data.list);
	  var db = getQueryParameter('db');
	  if (db != 'null') {
        $('a.mdl-layout__tab').removeClass('is-active');
        $('a[href="#scroll-tab-2"]').addClass('is-active');
        $('.mdl-layout__tab-panel').removeClass('is-active');
        $('#scroll-tab-2').addClass('is-active');      
      
        var lib = getByProperty(result.data.list, 'id', db);
        installControl($(ME).find('.libdetail')[0], 'metabot', 'libinfo', function(){}, lib);
            
        var loc = window.location.href;
        var i = loc.indexOf('?');
        loc = loc.substring(0,i);
        window.history.pushState(db, "MetaBot", loc);
      }
      $('#publish-tab')[0].api.setLibs(result.data.list);
  });
  
  
  json('../metabot/call', 'db=metabot&name=metabot&cmd=autoupdate&args={}', function(result){
    var el = $('#autoupdatelibraries').prop('checked', result.msg == 'true').parent()[0];
    if (typeof MaterialSwitch != 'undefined') {
      if (result.msg == 'true') el.MaterialSwitch.on();
      else el.MaterialSwitch.off();
    }
    
    $('#autoupdatelibraries').change(function(){
      var args = {val:""+$(this).prop("checked")};
      json('../metabot/call', 'db=metabot&name=metabot&cmd=autoupdate&args='+encodeURIComponent(JSON.stringify(args)), function(result){
        $('#autoupdatelibraries').prop('checked', result.msg == 'true');
        if (typeof MaterialSwitch != 'undefined') {
          if (result.msg == 'true') el.MaterialSwitch.on();
          else el.MaterialSwitch.off();
        }
      });
    });
  });
};

$(ME).find('.addlibrarybutton').click(function(){
  var data = {
    title:'New Library',
    text:'New library name',
    subtext:'lowercase letters, numbers, and underscores only.',
    cancel:'cancel',
    ok:'create',
    validate:function(val){
      if (val.length == 0) return false;
      var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';
      var i = val.length;
      while (i-->0) if (validchars.indexOf(val.charAt(i)) == -1) return false;
      return true;
    },
    cb: function(val){
      json('../botmanager/newdb', 'db='+encodeURIComponent(val)+'&readers='+encodeURIComponent(JSON.stringify(["anonymous"])), function(result){
        json('../botmanager/write', 'id=tasklists&data=%7B%7D&db='+encodeURIComponent(val), function(result){
          json('../metabot/call', 'db=metabot&name=metabot&cmd=libraries&args={}', function(result){
            if (result.data.data) result.data = result.data.data;
            result.data.list.sort(function(a,b) {return (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0);} ); 
            me.build(result.data.list);
            var lib = getByProperty(result.data.list, 'id', val);
            installControl($(ME).find('.page-content')[0], 'metabot', 'libinfo', function(){}, lib);
          });
        });
      });
    }
  };
  installControl($(ME).find('.dialogdiv')[0], 'metabot', 'promptdialog', function(){}, data);
});

me.build = function(list){
  ME.DATA.list = list;

  var t = $(ME).find('.listtable-inner');
  t.data('list', list);
  
  var cb = function(db){
    var lib = getByProperty(list, 'id', db);
    installControl($(ME).find('.libdetail')[0], 'metabot', 'libinfo', function(){}, lib);
    $(ME).find('.lesslibs').click();
  }
  t.data('cb', cb);
  
  cb = function(){
    var el = $("<img src='../botmanager/asset/botmanager/more_icon.png' class='roundbutton-small expandywidget pointy morelibs'>");
    el.click(function(){
      $(this).css('display', 'none');
      $(ME).find('.addlibrarybutton').css('display', 'none');
      $(ME).find('.lesslibs').css('display', 'block');
      $(ME).find('.listtable').animate({"width":"100%"}, 500);
      $(ME).find('.listtable-inner').animate({"left":"40px", "top":"40px"}, 500);
    });
    $(t.find('th')[1]).prepend(el);

    var el2 = $("<img src='../botmanager/asset/botmanager/close.png' class='roundbutton-small expandywidget pointy lesslibs thingreyborder'>");
    el2.click(function(){
      $(this).css('display', 'none');
      $(ME).find('.addlibrarybutton').css('display', 'block');
      $(ME).find('.morelibs').css('display', 'block');
      $(ME).find('.listtable').animate({"width":"180px"}, 500);
      $(ME).find('.listtable-inner').animate({"left":"-50px", "top":"0px"}, 500);
      $(ME).find('.shrinkme').css('display', 'table-row').css('opacity', '1');
      $(ME).find('.is-checked').removeClass('is-checked');
      $(ME).find('.is-selected').removeClass('is-selected');
    });
    $(t.find('th')[1]).prepend(el2);

    var n = t[0].api.updates.count;
    if (n>0){
//      var el3 = $('<div class="updatebadge material-icons mdl-badge mdl-badge--overlap" data-badge="'+n+'">get_app</div>');
      var el3 = $("<span style='position:relative;'><img src='../botmanager/asset/botmanager/download_icon.png' class='roundbutton-small availabledownloads'><span class='downloadbadge'>"+n+"</span></span>");
      $(t.find('th')[1]).append(el3);
      el3.click(function(){
//        $(this).css('display', 'none');
        el.click();
      });
    }
  }
  t.data('ready', cb);
  
  installControl(t[0], 'metabot', 'libraries', function(api){}, ME.DATA);
  
};
  
  