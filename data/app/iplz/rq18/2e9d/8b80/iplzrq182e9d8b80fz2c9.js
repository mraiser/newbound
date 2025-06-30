var me = document.body.ui = this;
var ME = $('#' + me.UUID)[0];

me.ready = function() {
  var el = $(ME).parent()[0];
  me.snacks = [];
  // When the core UI is ready, it looks for a uiReady function on its parent control's API and calls it.
  // This is how ui_reference.js gets its 'ui' object.
  if (el.api && el.api.uiReady)
    el.api.uiReady(me);
};

$(document).click(function(event) {
  window.lastElementClicked = event.target;
  window.lastClick = event;
});

me.snackbarMsg = function(msg, width) {
  var d = { "message": msg };
  if (width) d.width = width;
  me.snackbar(d);
};

me.snackbar = function(data) {
  if (me.snacking) {
    me.snacks.push(data);
  } else {
    me.snacking = true;
    var bar = $('<div class="snackbar"><div class="snackbar-inner">' + data.message + '</div></div>');
    bar.css('font-family', 'var(--font-family)');

    if (data.actionHandler) {
      var action = $('<div class="snackbar-action">' + data.actionText + '</div>');
      action.click(function(e) {
        $(this).css('display', 'none');
        data.actionHandler(e);
      });
      bar.find('.snackbar-inner').append(action);
    }
    if (data.width) bar.find('.snackbar-inner').css('width', data.width);
    
    $(document.body).append(bar);

    bar.animate({ bottom: '20px' }, 500);
    var timeout = data.timeout ? data.timeout : 3500;

    setTimeout(function() {
      bar.animate({ bottom: '-100px' }, 500, function() {
        bar.remove();
        me.snacking = false;
        if (me.snacks.length > 0)
          me.snackbar(me.snacks.shift());
      });
    }, timeout);
  }
};


me.initSliders = function(el){
    $(el).find('.plainslider').on('input', function() {
        var value = (this.value - this.min) / (this.max - this.min) * 100;
        this.style.background = 'linear-gradient(to right, var(--primary-color) 0%, var(--primary-color) ' + value + '%, var(--border-color-light) ' + value + '%, var(--border-color-light) 100%)';
    }).trigger("input");
};


me.initNavbar = function(el) {
  $(el).find('.navbar-tab').click(function() {
    var which = $(this).data('id');
    $(el).find('.navbar-tab').removeClass('selected');
    $(el).find('.tab-content').removeClass('selected');
    $(this).addClass('selected');
    $(el).find('.' + which).addClass('selected');
  });
};

me.initTooltips = function(el) {
  $(el).find('.tooltip').on('mouseover', function(event) {
    if (!this.tooltip) {
      var data = $(this).data('tooltip');
      if (!data || !data.message) return;

      var el2 = $('<div class="tooltip-wrap">' + data.message + '</div>');
      $(document.body).append(el2); // Append to body to avoid parent clipping issues
      this.tooltip = el2;

      var triggerRect = this.getBoundingClientRect();
      var tipRect = el2[0].getBoundingClientRect();
      var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      // Position tooltip centered above the element
      var x = triggerRect.left + (triggerRect.width / 2) - (tipRect.width / 2);
      var y = triggerRect.top - tipRect.height - 8; // 8px spacing

      // Adjust if it goes off screen
      if (y < 0) { // If not enough space on top, show below
        y = triggerRect.top + triggerRect.height + 8;
      }
      if (x < 0) x = 5;
      if ((x + tipRect.width) > window.innerWidth) x = window.innerWidth - tipRect.width - 5;
      
      el2.css({
        top: (y + scrollTop) + 'px',
        left: (x + scrollLeft) + 'px',
        opacity: 0
      }).stop().animate({ opacity: 1 }, 200);
    }
  });

  $(el).find('.tooltip').on('mouseout', function(event) {
    if (this.tooltip) {
      $(this.tooltip).stop().animate({ opacity: 0 }, 200, function() {
        $(this).remove();
      });
      this.tooltip = null;
    }
  });
};

me.initPopups = function(el) {
  $(el).find('.popupmenu').click(function(event) {
    var data = $(this).data('popup');
    if (data) {
        data.clientX = event.clientX;
        data.clientY = event.clientY;
        me.popup(data);
    }
  });
};

me.closePopup = function(data, cb) {
  var el2 = $(data.selector);
  if (data && data.modal) {
    var w = el2.outerWidth();
    var h = el2.outerHeight();
    el2.animate({
      left: data.clientX + 'px',
      top: data.clientY + 'px',
      width: '0px',
      height: '0px',
      opacity: 0
    }, 300, function() {
      el2.css('display', 'none');
      // Restore original dimensions for next time
      el2.css({ 'width': '', 'height': '', 'opacity': 1 });
      if (cb) cb();
      if (data.close) data.close();
    });
  } else {
    el2.css('display', 'none');
    if (data.close) data.close();
  }

  if (data.bg) {
    $(data.bg).fadeOut(300, function() {
      $(this).remove();
    });
  }
}

me.popup = function(data, cb) {
  var el2 = $(data.selector);
  if (!el2.length) {
      console.error("Popup selector not found:", data.selector);
      return;
  }
  var bg = null;

  if (data.modal) {
    bg = data.bg = $('<div class="greyedout"></div>').hide().appendTo(document.body).fadeIn(300);

    // Correctly measure the dimensions of the hidden modal
    el2.css({ position: 'absolute', visibility: 'hidden', display: 'block' });
    var w = el2.outerWidth();
    var h = el2.outerHeight();
    el2.css({ position: '', visibility: '', display: '' }); // Reset styles

    // Set initial state for animation
    el2.css({
      'display': 'block',
      'position': 'fixed',
      'z-index': '15',
      'width': '0px',
      'height': '0px',
      'top': data.clientY + 'px',
      'left': data.clientX + 'px',
      'opacity': 0
    });
    
    var x = (window.innerWidth - w) / 2;
    var y = (window.innerHeight - h) / 2;

    // Animate to final state, including height
    el2.animate({
      left: x + 'px',
      top: y + 'px',
      width: w + 'px',
      height: h + 'px',
      opacity: 1
    }, 400, function() {
      // After animation, remove fixed width/height so it can be responsive
      el2.css({'width': '', 'height': ''});
      if (cb) cb();
    });

  } else {
    // --- FIX for Non-Modal Popups (like context menus) ---
    // Position and display the popup off-screen to guarantee correct measurement
    el2.css({
      'position': 'fixed',
      'z-index': '6',
      'left': '-9999px',
      'top': '-9999px',
      'display': 'block',
      'visibility': 'visible'
    });

    var popWidth = el2.outerWidth();
    var popHeight = el2.outerHeight();

    var x = data.clientX;
    var y = data.clientY;

    // Prevent menu from going off-screen
    if (x + popWidth > window.innerWidth) {
        x = window.innerWidth - popWidth - 10;
    }
    if (y + popHeight > window.innerHeight) {
        y = window.innerHeight - popHeight - 10;
    }

    // Now set the final on-screen position
    el2.css({
      'left': x + 'px',
      'top': y + 'px'
    });
    
    // Add a one-time click handler to the document to close the popup
    setTimeout(function() {
      $(document).one('click', function(e) {
          if (!el2.is(e.target) && el2.has(e.target).length === 0) {
               me.closePopup(data);
          }
      });
    }, 50);

    if (cb) cb();
  }

  var selector = data.closeselector ? data.closeselector : '.popupcard-close';
  el2.find(selector).off('click').on('click', function() {
    me.closePopup(data);
  });
};

me.prompt = function(d) {
  var val = d.value ? d.value : "";
  var sub = d.subtext ? d.subtext : "";
  var ok = d.ok ? d.ok : "ok";

  var el = $(`
    <div class="fixed-wrap">
      <div class="card modal mydialog">
        <div class="pad16 card-header dialog-header">
          <span class="title">${d.title}</span>
          <button class="popupcard-close close-prompt-dialog">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="pad16">
          <label class="textinputlabel" for="prompt-input-${me.UUID}">${d.text}</label>
          <input class="textinput" type="text" id="prompt-input-${me.UUID}" value="${val}">
        </div>
        <div class="subtext card-description pad16" style="padding-top:0;">${sub}</div>
        <div class="card-button-wrap">
          <a class="continuebutton coloredbutton">${ok}</a>
        </div>
      </div>
    </div>
  `);

  $(document.body).append(el);
  d.selector = el.find('.card')[0];
  d.closeselector = el.find('.close-prompt-dialog')[0];
  d.modal = true;
  d.close = function() { el.remove(); };
  d.clientX = window.innerWidth / 2;
  d.clientY = window.innerHeight / 2;

  me.popup(d, function() {
    el.find('input.textinput').select().focus();
  });

  el.find('.continuebutton').click(function() {
    var val = el.find('input.textinput').val();
    if (d.validate) {
      if (d.validate(val)) {
        d.cb(val);
        me.closePopup(d);
      } else {
        el.find('.subtext').css("color", "var(--error-color)");
      }
    } else {
      d.cb(val);
      me.closePopup(d);
    }
  });
};

me.confirm = function(d) {
    var text = d.text ? d.text : "";
    var ok = d.ok ? d.ok : "OK";
    var cancel = d.cancel ? d.cancel : "Cancel";

    var el = $(`
    <div class="fixed-wrap">
        <div class="card modal mydialog">
            <div class="pad16 card-header dialog-header">
                <span class="title">${d.title}</span>
                 <button class="popupcard-close close-prompt-dialog">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                 </button>
            </div>
            <div class="subtext card-description pad16">${text}</div>
            <div class="card-button-wrap">
                <a class="cancelbutton regularbutton">${cancel}</a>
                <a class="continuebutton coloredbutton">${ok}</a>
            </div>
        </div>
    </div>`);

    $(document.body).append(el);
    d.selector = el.find('.card')[0];
    d.closeselector = '.close-prompt-dialog, .cancelbutton';
    d.modal = true;
    d.close = function(){ el.remove(); };
    d.clientX = window.innerWidth / 2;
    d.clientY = window.innerHeight / 2;
    
    me.popup(d);
    
    el.find('.continuebutton').click(function(){
        if(d.cb) d.cb(true); // Confirm true
        me.closePopup(d);
    });

    el.find('.cancelbutton').click(function(){
        if(d.cb) d.cb(false); // Confirm false
        me.closePopup(d);
    });
};


me.initProgress = function(el) {
  var bars = $(el).find('.progressbar').toArray();
  for (var i in bars) {
    var bar = bars[i];
    $(bar).html('<div class="progressbar-inner"></div>');
    $(bar).data('percent', 0);
    bar.indeterminate = false;
    bar.setProgress = function(val) {
      var progbar = $(this).find('.progressbar-inner');
      if (val == 'indeterminate') {
        this.indeterminate = true;
        progbar.css({
            'transition': 'all 0.8s ease-in-out',
            'animation': 'indeterminate-progress 2s infinite linear'
        });
        if (!$('#indeterminate-keyframes').length) {
            $('<style id="indeterminate-keyframes">@keyframes indeterminate-progress { 0% { left: -50%; width: 50%; } 100% { left: 100%; width: 50%; } }</style>').appendTo('head');
        }
      } else {
        this.indeterminate = false;
        progbar.css({
            'animation': 'none',
            'transition': 'width 0.3s ease',
            'width': val + '%',
            'left': '0%'
        });
        $(this).data('percent', val);
      }
    };
  }
};


if (typeof componentHandler == 'undefined') componentHandler = {
  upgradeAllRegistered: function() {}
};
