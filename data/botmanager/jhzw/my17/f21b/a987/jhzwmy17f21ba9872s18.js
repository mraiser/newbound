var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var el = $(ME).parent()[0];
  me.snacks = [];
  if (el.api && el.api.uiReady)
    el.api.uiReady(me);
};

$(document).click(function(event) {
  window.lastElementClicked = event.target;
  window.lastClick=event;
});

me.snackbar = function(data){
  if (me.snacking) {
    me.snacks.push(data);
  }
  else {
    me.snacking = true;
    var bar = $('<div class="snackbar"><div class="snackbar-inner">'+data.message+'</div></div>');
    bar.css('font-family', $('.wrap').css('font-family'));
    if (data.actionHandler){
      var action = $('<div class="snackbar-action">'+data.actionText+'</div>');
      action.click(function(e){
        $(this).css('display', 'none');
        data.actionHandler(e);
      });
      bar.find('.snackbar-inner').append(action);
    }
    if (data.width) bar.find('.snackbar-inner').css('width', data.width);
    $(ME).parent().append(bar);
    bar.animate({bottom: '0px'},500);
    var timeout = data.timeout ? data.timeout : 2750;
    setTimeout(function(){
      bar.animate({bottom: '-60px'},500, function(){
        bar.remove();
        me.snacking = false;
        if (me.snacks.length>0) 
          me.snackbar(me.snacks.shift());
      });
    }, timeout);
  }
};

me.initSliders = function(el){
  $(el).find('.plainslider').on('input', function() {
    var value = (this.value-this.min)/(this.max-this.min)*100
    this.style.background = 'linear-gradient(to right, #83bc00 0%, #83bc00 ' + value + '%, #fff ' + value + '%, white 100%)'
  }).trigger("input");
};

me.initNavbar = function(el){
  $(el).find('.navbar-tab').click(function(){
    var which = $(this).data('id');
    $(el).find('.navbar-tab').removeClass('selected');
    $(el).find('.tab-content').removeClass('selected');
    $(this).addClass('selected');
    $(el).find('.'+which).addClass('selected');
  });
};

me.initTooltips = function(el){
  $(el).find('.tooltip').mouseover(function(event){
    if (!this.tooltip){
      var data = $(this).data('tooltip');

      var el2 = $('<div class="tooltip-wrap">'+data.message+'</div>');
      el2.css('font-family', $('.wrap').css('font-family'));
      $(this).after(el2);
      this.tooltip = el2;

      var b = this.getBoundingClientRect();
      var o = $(this).offset();
      var w = el2[0].getBoundingClientRect().width;
      var h = el2.height();
      var x = o.left + ((w-b.width)/2);
      var y = o.top - $(window).scrollTop() + b.height + 10;

      el2.css('display', 'inline-block');
      el2.css('position', 'fixed');
      el2.css('z-index', '6');
      el2.css('width', '0px');
      el2.css('height', '0px');
      el2.css('top', y+'px');
      el2.css('left', (o.left + (b.width/2))+'px');
      el2.animate({left:x+'px',top:y+'px',width:w+'px',height:h+'px'}, 100);
    }
  });
  $(el).find('.tooltip').mouseout(function(event){
    this.tooltip.remove();
    this.tooltip = null;
  });
};

me.initPopups = function(el){
  $(el).find('.popupmenu').click(function(event){
    $(el).find('.popupcard').css('display', 'none'); // FIXME - popupcard is deprecated
    var data = $(this).data('popup');
    var selector = data ? data.selector : '.'+$(this).data('id'); // FIXME - data-id is deprecated
    data = data ? data : {selector:selector};
    data.clientX = event.clientX;
    data.clientY = event.clientY;
    me.popup(data);
  });
};

me.popup = function(data){
  var el2 = $(data.selector);

  var bg = null;

  if (data.modal){
    bg = $('<div class="greyedout"></div>');
    $(document.body).append(bg);
    var w = el2.width();
    var h = el2.height();
    var x = (window.innerWidth-w)/2;
    var y = (window.innerHeight-h)/2;
    el2.css('display', 'block');
    el2.css('position', 'fixed');
    el2.css('z-index', '6');
    el2.css('width', '0px');
    el2.css('height', '0px');
    el2.css('top', data.clientY+'px');
    el2.css('left', data.clientX+'px');
    el2.animate({left:x+'px',top:y+'px',width:w+'px',height:h+'px'}, 500);
  }
  else el2.css('display', 'inline-block');

  selector = data.closeselector ? data.closeselector : '.popupcard-close';
  el2.find(selector).click(function(){
    if (data && data.modal){
      el2.animate({left:data.clientX+'px',top:data.clientY+'px',width:'0px',height:'0px'}, 500, function(){
        el2.css('display', 'none');
        el2.css('width', w+'px');
        el2.css('height', h+'px');
      });
    }
    else el2.css('display', 'none');
    if (bg) {
      bg.css('display', 'none');
      bg.remove();
    }
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
        var dur = 500;
        function update(){
          if (bar.indeterminate){
            $(progbar).css('left', '0%').css('width', '0%').animate({'left':'25%', 'width':'75%'},dur, 'linear', function(){
              if (bar.indeterminate){
                $(progbar).animate({'left':'100%','width':'0%'},dur, 'linear', update);
              }
              else $(progbar).css('left', '0%').css('width', $(bar).data('percent')+'%');
            });
          }
          else $(progbar).css('left', '0%').css('width', $(bar).data('percent')+'%');
        }
        update();
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
