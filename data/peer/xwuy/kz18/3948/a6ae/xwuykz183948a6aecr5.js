var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = me.refresh = function(){
  me.check = $(ME).find('.rp-uuid')[0];
  me.update();
  document.body.api.ui.initNavbar(ME);
  
  var uuid = ME.DATA.id;
  // FIXME
  json('../peer/remote/'+uuid+'/app/libs', null, function(result){
    if (result.data && document.body.locallibraries) {
      var el = $(ME).find('.upgradelist');
      for (var i in result.data) {
        var theirlib = result.data[i];
        var mylib = getByProperty(document.body.locallibraries, 'id', theirlib.id);
        var author = mylib.author;
        var authorkey = mylib.authorkey;
        if (author && authorkey && theirlib.author == author && theirlib.authorkey == authorkey) {
          if (mylib.version > theirlib.version) {
            
            var newhtml = '<span class="chip ispos" id="U_'+mylib.id+'"><span class="clickupdate" data-lib="'+mylib.id+'" data-version="'+mylib.version+'">'
              + mylib.id 
              + ' v' 
              + theirlib.version 
              + ' ➤ ' 
              + mylib.version 
              + '</span><img src="../app/asset/app/close-white.png" class="roundbutton-small removeupdate mdl-chip__action chipbutton"></span> ';
            
            $(ME).find('.availableupgrades').css('display', 'block');
            el.append(newhtml);
          }
        }
      }
      el.find('.removeupdate').click(function(){
        $(this).closest('.chip').remove();
      });
    }
  });
};

me.install = function(lib, v, cb) {
  var myuuid = $('.localpeerid').text();
  var uuid = ME.DATA.id;
  var el = $(ME).find('#U_'+lib);
  el.animate({'width':'100%','height':'60px'},300, function(){
    el.append("<div class='progressbar myprogress'></div>");
    document.body.api.ui.initProgress(ME);
    el.find('.myprogress')[0].setProgress('indeterminate');
  });
  var d = 'uuid='+myuuid+'&lib='+lib;
  json('../peer/remote/'+uuid+'/dev/install_lib', d, function(result){
    if (result.data) {
      el.find('.myprogress')[0].setProgress(100);
      el.animate({'width':'0px','height':'0px'},300, function(){
        el.remove();
      });
      if (cb) cb();
    }
    else {
      el.find('.myprogress').remove();
      el.append("<div class='progerr'><font color='red'>Error: "+result.msg+"</font></div>");
    }
  });
}

$(ME).find('.closehud').click(function(){
  var el = $("#headsupdisplay");
  el.animate({width:0}, 300, function(){ el.css('display', 'none').html(''); });
  $(ME).parent()[0].api.focus(null);
});

me.update = function(){
  if (me.check == $(ME).find('.rp-uuid')[0]) {
    ME.DATA = $('#peer_'+ME.DATA.id)[0].DATA;
    $(ME).find('.rp-name').text(ME.DATA.name);
    $(ME).find('.rp-uuid').text(ME.DATA.id);
    $(ME).find('.hud_ipaddr').text(ME.DATA.address);
    $(ME).find('.hud_port').text(ME.DATA.p2p_port);
    $(ME).find('.hud_http_port').text(ME.DATA.http_port);
    $(ME).find('#keepalive').prop('checked', ME.DATA.keepalive);
    
    var newhtml = '';
    for (var i in ME.DATA.addresses) {
      newhtml += '<a class="chip" target="_blank" href="http://'+ME.DATA.addresses[i]+':'+ME.DATA.http_port+'?session_id='+ME.DATA.session_id+'">'+ME.DATA.addresses[i]+'</a>&nbsp;'
    }
    $(ME).find('.hud_address_list').html(newhtml);

    var c = ME.DATA.tcp ? '#84bd00' : ME.DATA.udp ? '#00f' : ME.DATA.connected ? '#ff0' : 'ccc';
    $(ME).find('.connectionindicator').css('background-color', c);
    var l = ME.DATA.latency ? ME.DATA.latency+'ms' : '--';
    $(ME).find('.connectionlatency').text(l);
    
    setTimeout(me.update, 3000);
  }
};

$(ME).find('.addressexpandbutton').click(function(){
  $(this).css('display', 'none');
  $(ME).find('.closeaddressbutton').css('display', 'inline-block');
  $(ME).find('.addressexpand').css('display', 'block');
});

$(ME).find('.closeaddressbutton').click(function(){
  $(this).css('display', 'none');
  $(ME).find('.addressexpandbutton').css('display', 'inline-block');
  $(ME).find('.addressexpand').css('display', 'none');
});

$(ME).find('.cancelupdateall').click(function(){
  $(ME).find('.availableupgrades').css('display', 'none');
});

function updateNext(){
  if (ulist.length > 0) {
    var el = ulist.shift();
    var lib = el[0];
    var v = el[1];
    me.install(lib, v, updateNext);
  }
  else {
    $(ME).find('.availableupgrades').animate({"opacity":0},300, function(){
      $(this).css('display', 'none').css('opacity', '100%');
    });
  }
}

var ulist = [];
$(ME).find('.updateall').click(function(){
  $(ME).find('.updatebuttons').css('display', 'none');
  ulist = [];
  $(ME).find('.upgradelist').find('.chip').each(function(){
    var el = $(this).find('.clickupdate');
    var lib = el.data("lib");
    var v = el.data("version");
    ulist.push([lib,v]);
  });
  updateNext();
});