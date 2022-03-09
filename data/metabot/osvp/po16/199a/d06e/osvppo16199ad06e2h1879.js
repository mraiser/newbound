var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  if (typeof componentHandler != 'undefined')
    componentHandler.upgradeAllRegistered();
  if (ME.DATA.title){
    $(ME).find('.mdl-card__title-text').text(ME.DATA.title);
    $(ME).find('.mdl-textfield__label').text(ME.DATA.text);
    $(ME).find('.subtext').text(ME.DATA.subtext);
    $(ME).find('.continuebutton').text(ME.DATA.ok);
    $(ME).find('.cancelbutton').text(ME.DATA.cancel);
    $(ME).find('#sample3').val(ME.DATA.value);
    
    if (typeof MaterialTextfield != 'undefined')
      $(ME).find('#sample3').parent()[0].MaterialTextfield.checkDirty();
  }
  
  var x1, y1;
  
  if (window.lastElementClicked) {
    var o = $(window.lastElementClicked).offset();
    x1 = o.left;
    y1 = o.top;
  }
  else {
    x1 = 0;
    y1 = 0;
  }
  
  var y2 = Math.max(112, ($(window).height()/2)-200);
  
  $(ME).find('.dbg').css('left', x1+'px').css('top', y1+'px').animate({top: y2+'px', left:'0px',width:'100%',height:'100%'},500);
  $(ME).find('.cancelbutton').click(function(){
    $(ME).find('.dbg').animate({top:y1+'px',left:x1+'px',width:'0px',height:'0px'},500);
    $(ME).find('.greyedout').css('display', 'none');
  });
  $(ME).find('.continuebutton').click(function(){
    
    if (!ME.DATA.validate || ME.DATA.validate($(ME).find('#sample3').val())){
      ME.DATA.cb($(ME).find('#sample3').val());
      $(ME).find('.dbg').animate({width:'0px',height:'0px'},500);
      $(ME).find('.greyedout').css('display', 'none');
    }
  });
  
  if (ME.DATA.validate) {
    $(ME).find('#sample3').keyup(validate);
    $(ME).find('#sample3').change(validate);
    validate();
  }
};

function validate(){
  var isok = ME.DATA.validate($(ME).find('#sample3').val());
  if (isok) $(ME).find('.continuebutton').removeAttr('disabled').removeClass('mdl-button--disabled');
  else $(ME).find('.continuebutton').attr("disabled", "disabled").addClass('mdl-button--disabled');
}
