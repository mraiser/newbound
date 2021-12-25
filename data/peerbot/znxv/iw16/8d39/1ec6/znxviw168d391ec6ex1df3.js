var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = me.refresh = function(){
  var data = ME.DATA;
  var b = data.connected;
  var i = data.strength;
  var s = makeDot(b, i>0) + makeDot(b, i>1) + makeDot(b, i>2);
  s += '<br><span class="hudms">'+(data.millis>15000 ? '&infin;' : (data.millis/1000).toFixed(1)+'s')+'</span>';
  $(ME).find('.pb-peer-strength').html(s);
}

function makeDot(b1, b2){
  return '<div class="connectionindicator" style="background-color:'+(b1 && b2 ? '#84bd00' : b2 ? '#ff0' : '#ccc')+';"></div>';
}

$(ME).find('.pb-peer-strength').click(function(){
  if (!ME.DATA.connected || !ME.DATA.tcp){
    json('../peerbot/connect', 'uuid='+ME.DATA.id, function(result){});
  }
});