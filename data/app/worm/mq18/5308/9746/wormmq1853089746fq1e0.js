var me = this;
var ME = $('#'+me.UUID)[0];

var data = me.data = $(ME).data('control');
var canvas = me.canvas = $(ME).find('canvas')[0];
var ctx = me.ctx = canvas.getContext('2d');

me.ready = function(){
  me.value = $.isNumeric(me.data.value) ? me.data.value : '--';
  me.units = me.data.units ? me.data.units : '';
  me.title = me.data.title ? me.data.title : '';
  me.range = me.data.range ? me.data.range : [0, 100];
  me.refresh = me.data.refresh; 
  me.redraw();
  
  if (me.refresh){
    function r(){
      me.refresh(function(){
        me.redraw();
        if (me.refresh && $('#'+me.UUID)[0]) setTimeout(r, 1000);
      });
    }
    r();
  }
};

me.redraw = function(){
  var w = $(ME).width();
  var h = $(ME).height();
  
  var L = Math.min(w,h);
  var offx = (w-L)/2;
  var offy = (h-L)/2;

  var v = me.value;
  var percent = $.isNumeric(me.data.value) ? (v - me.range[0]) / (me.range[1] - me.range[0]) : 0;
  var units = me.units;

  var large = 56*L/150;
  var medium = 24*L/150;
  var small = 18*L/150;
  
  var stroke1 = 15*L/150;
  var stroke2 = 5*L/150;
  var stroke3 = 2*L/150;
  
  offy += large / 3;

  var h1 = offy + 0 + L/2; //yoff + 24*h/150;
  var h2 = offy + large*0.65;
  var h3 = offy + medium / 2; //*h/150;

  canvas.width = w;
  canvas.height = h;
  
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = stroke1;
  ctx.beginPath();
  ctx.arc(offx+L/2,h1,L/3,0.75*Math.PI,2*Math.PI);
  ctx.stroke();    
  
  ctx.strokeStyle = '#4b8c2a';
  ctx.beginPath();
  ctx.arc(offx+L/2,h1,L/3,0.75*Math.PI,0.75*Math.PI + percent*1.25*Math.PI);
  ctx.stroke();  
  
  ctx.font = medium+"px Arial";
  ctx.fillStyle = '#fff';
  ctx.lineWidth = stroke3;
  ctx.strokeStyle = '#000';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'black';

  ctx.strokeText(me.title,offx+L/2,h3);
  ctx.fillText(me.title,offx+L/2,h3);

  ctx.font = large+"px Arial";
  ctx.lineWidth = stroke2;
  ctx.strokeText(v,offx+L/2,h1+large/4);
  ctx.fillText(v,offx+L/2,h1+large/4);

  ctx.font = small+"px Arial";
  ctx.lineWidth = stroke3;
  ctx.strokeText(units,offx+L/2,h1+h2-offy);
  ctx.fillText(units,offx+L/2,h1+h2-offy);
};

me.update = function(d){
  me.value = me.data.value = d;
  me.redraw();
};
