var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var el = $(ME).parent()[0];
  if (el.api && el.api.uiReady)
    el.api.uiReady(me);
};

$(document).click(function(event) {
   window.lastElementClicked = event.target;
});

me.initNavbar = function(el){
  $(el).find('.navbar-tab').click(function(){
    var which = $(this).data('id');
    $(el).find('.navbar-tab').removeClass('selected');
    $(el).find('.tab-content').removeClass('selected');
    $(this).addClass('selected');
    $(el).find('.'+which).addClass('selected');
  });
};

me.initPopups = function(el){
  $(el).find('.popupmenu').click(function(){
    $(el).find('.popupcard').css('display', 'none');
    $(el).find('.'+$(this).data('id')).css('display', 'inline-block');
  });

  $(el).find('.popupcard-close').click(function(){
    $(el).find('.popupcard').css('display', 'none');
  });
};

me.initProgress = function(el){
  var bars = $(el).find('.progressbar').toArray();
  for (var i in bars) {
    var bar = bars[i];
    $(bar).html('<div class="progressbar-inner"></div>');
    $(bar).data('percent', 0);
    bar.indeterminate = false;
    bar.setProgress = function(val){
      $(bar).data('percent', val);
      var progbar = $(bar).find('.progressbar-inner');
      if (val == 'indeterminate'){
        bar.indeterminate = true;
        var dur = 800;
        $(progbar).css('left', '-50%').css('width', '50%').animate({'left':'100%'},dur, function(){
          function update(){
            if (bar.indeterminate){
              dur = dur == 800 ? 1500 : 800;
              $(progbar).css('left', '-50%').animate({'left':'100%'},dur, update);
            }
            else $(progbar).css('left', '0%').css('width', $(bar).data('percent')+'%');
          }
          update();
        });
      }
      else{
        if (!bar.indeterminate) progbar.css('width', val+'%');
        bar.indeterminate = false;
      }
    };
  }
};

if (typeof componentHandler == 'undefined') componentHandler = {
  upgradeAllRegistered: function(){}
};
