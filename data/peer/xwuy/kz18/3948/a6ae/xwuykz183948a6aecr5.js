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
      for (var i in result.data) {
        var theirlib = result.data[i];
        var mylib = getByProperty(document.body.locallibraries, 'id', theirlib.id);
        var author = mylib.author;
        var authorkey = mylib.authorkey;
        if (author && authorkey && theirlib.author == author && theirlib.authorkey == authorkey) {
          if (mylib.version > theirlib.version) {
            var newhtml = mylib.id + '<br>';
            $(ME).find('.upgradelist').append(newhtml);
            $(ME).find('.availableupgrades').css('display', 'block');
          }
        }
      }
    }
  });
};

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
      newhtml += '<a class="chip" target="_blank" href="http://'+ME.DATA.addresses[i]+':'+ME.DATA.http_port+'?session_id='+ME.DATA.session_id+'">'+ME.DATA.addresses[i]+'</a>&nbsp;&nbsp;&nbsp;'
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