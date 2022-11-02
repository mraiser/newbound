var me = this;
var ME = $('#'+me.UUID)[0];

var canvas = me.canvas = $(ME).find('canvas')[0];
var ctx = me.ctx = canvas.getContext('2d');

me.ready = function(){
  me.title = 'Reboot Device';
  me.redraw();
  $(canvas).hover(function(x){ 
    me.hover = x.type == 'mouseenter';
    me.redraw();
  });
  $(canvas).click(function(){ 
    var el = $('<div class="popup999 wrap"/>');
    $('body').append(el);
    var data = {
      title:'Reboot Device',
      text:'Are you sure you want to reboot the device?',
      cb:function(){
        var peer = ME.DATA.peer;
        var api = $('#peer_'+peer)[0].api;
        api.sphere.rotation.speed = 0.05;
        json('../peer/remote/'+peer+'/app/exec', 'lib=peer&id=sqgqnm18434391301x302&args={}', function(result){
          api.sphere.rotation.speed = null;
          if (result.status != 'ok') document.body.api.ui.snackbarMsg(result.msg, '600px');
        });
      }
    };
    installControl(el[0], 'metabot', 'confirmdialog', function(result){}, data);
  });
};

me.redraw = function(){
  var w = $(ME).width();
  var h = $(ME).height();
  
  var L = Math.min(w,h);
  var offx = (w-L)/2;
  var offy = (h-L)/2;
  
  var fontsize = 18*L/150;
  var stroke1 = 15*L/150;
  var stroke2 = 2*L/150;

  var h3 = 130*L/150;

  canvas.width = w;
  canvas.height = h;
  
  ctx.lineWidth = stroke1;
  ctx.strokeStyle = me.hover ? '#4bff2a' : '#4b8c2a';
  ctx.fillStyle = me.hover ? '#4bff2a' : '#4b8c2a';
  
  var delta = 0.14;
  var off = L * delta;
  var bw = L * (1-delta*2);
  var radius = bw * 0.40;
  var stroke = bw / 10;

  var rs = radius + stroke + off;

  ctx.beginPath();
  ctx.arc(rs+offx, rs-off/2, radius, -0.4 * Math.PI , 1.4 * Math.PI, false);
  ctx.lineWidth = stroke;
  ctx.stroke();
  ctx.fillRect(radius + (stroke/2)+off+offx, off/2, stroke, rs);
  
  ctx.font = fontsize+"px Arial";
  ctx.fillStyle = '#fff';
  ctx.lineWidth = stroke2;
  ctx.strokeStyle = '#000';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'black';

  ctx.strokeText(me.title,w/2,h3);
  ctx.fillText(me.title,w/2,h3);
};
