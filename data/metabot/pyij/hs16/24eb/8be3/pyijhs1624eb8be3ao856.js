var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  componentHandler.upgradeAllRegistered();

  var x1, y1;
  if (window.lastElementClicked) {
    var el = $(window.lastElementClicked);
    var o = el.offset();
    x1 = o.left; // + el.width()/2;
    y1 = o.top - $('body').scrollTop(); // + el.height()/2;
    $(ME).find('.dbg').width(el.width()).height(el.height());
  }
  else {
    x1 = 0;
    y1 = 0;
  }
  
  var y2 = Math.max(112, (($(window).height()-112)/2)-$(ME).height()/2);
  
  $(ME).find('.dialog-card-wide').width($(ME).width()).height($(ME).height());
  $(ME).css('display', 'block');

  $(ME).find('.allthestuff').append(me.oldhtml).css('opacity', '1');
  $(ME).find('.dbg').css('left', x1+'px').css('top', y1+'px').animate({top: y2+'px', left:'0px',width:'100%',height:'100%'},500, function(){});
  
  me.close = function(cb){
    $(ME).find('.dbg').animate({top:y1+'px',left:x1+'px',width:'0px',height:'0px'},500, cb);
    $(ME).find('.greyedout').css('display', 'none');
  };
  
  me.reset = function(cb){
    $(ME).html(me.oldhtml);
    if (cb) cb();
  };
  
  me.closeAndReset = function(cb){
    me.close(function(){
      $(ME).css('display', 'none');
      me.reset(function(){
        if (cb) cb();
      });
    });
  };
  if (ME.DATA.cb) ME.DATA.cb(me);
};
