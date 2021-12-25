var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  if (ME.DATA.title){
    $(ME).find('.mdl-card__title-text').html(ME.DATA.title);
    $(ME).find('.mdl-card__supporting-text').html(ME.DATA.text);
    $(ME).find('.continuebutton').html(ME.DATA.ok);
    $(ME).find('.cancelbutton').html(ME.DATA.cancel);
  }
  
  $(ME).find('.dbg').animate({width:'100%',height:'100%'},500);
  $(ME).find('.cancelbutton').click(function(){
    $(ME).find('.dbg').animate({width:'0px',height:'0px'},500);
    $(ME).find('.greyedout').css('display', 'none');
  });
  $(ME).find('.continuebutton').click(function(){
    ME.DATA.cb();
    $(ME).find('.dbg').animate({width:'0px',height:'0px'},500);
    $(ME).find('.greyedout').css('display', 'none');
  });
};