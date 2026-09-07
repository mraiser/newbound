var me = document.body.ui = this;
var ME = document.getElementById(me.UUID);

// data-* attributes are strings; JSON-looking values parse (what jQuery's
// .data() did for the popup/tooltip payloads).
function readData(el, name) {
  var v = el.dataset[name];
  if (v == null) return null;
  if (v[0] == '{' || v[0] == '[') { try { return JSON.parse(v); } catch (x) {} }
  return v;
}

// Popup data carries selector as a string OR an element (prompt passes elements).
function resolveEl(sel) {
  return typeof sel === 'string' ? document.querySelector(sel) : sel;
}

function setStyles(el, styles) { for (var k in styles) el.style[k] = styles[k]; }

function animateTo(el, props, ms, cb) {
  var done = function() { setStyles(el, props); if (cb) cb(); };
  try {
    var from = {}, cs = getComputedStyle(el);
    for (var k in props) from[k] = cs[k];
    var anim = el.animate([from, props], { duration: ms, easing: 'ease' });
    anim.onfinish = done;
  } catch (x) { done(); }
}

function fadeIn(el, ms, cb) {
  el.style.opacity = '0';
  el.style.display = 'block';
  animateTo(el, { opacity: '1' }, ms, cb);
}

function fadeOut(el, ms, cb) {
  animateTo(el, { opacity: '0' }, ms, function() { el.style.display = 'none'; if (cb) cb(); });
}

function fromHTML(html) {
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.firstElementChild;
}

me.ready = function() {
  var el = ME.parentElement;
  me.snacks = [];
  // When the core UI is ready, it looks for a uiReady function on its parent control's API and calls it.
  // This is how ui_reference.js gets its 'ui' object.
  if (el.api && el.api.uiReady)
    el.api.uiReady(me);
};

document.addEventListener('click', function(event) {
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
    var bar = fromHTML('<div class="snackbar"><div class="snackbar-inner">' + data.message + '</div></div>');
    bar.style.fontFamily = 'var(--font-family)';
    var inner = bar.querySelector('.snackbar-inner');

    if (data.actionHandler) {
      var action = fromHTML('<div class="snackbar-action">' + data.actionText + '</div>');
      action.addEventListener('click', function(e) {
        this.style.display = 'none';
        data.actionHandler(e);
      });
      inner.appendChild(action);
    }
    if (data.width) inner.style.width = data.width;

    document.body.appendChild(bar);

    animateTo(bar, { bottom: '20px' }, 500);
    var timeout = data.timeout ? data.timeout : 3500;

    setTimeout(function() {
      animateTo(bar, { bottom: '-100px' }, 500, function() {
        bar.remove();
        me.snacking = false;
        if (me.snacks.length > 0)
          me.snackbar(me.snacks.shift());
      });
    }, timeout);
  }
};


me.initSliders = function(el) {
  el.querySelectorAll('.plainslider').forEach(function(s) {
    function paint() {
      var value = (s.value - s.min) / (s.max - s.min) * 100;
      s.style.background = 'linear-gradient(to right, var(--primary-color) 0%, var(--primary-color) ' + value + '%, var(--border-color-light) ' + value + '%, var(--border-color-light) 100%)';
    }
    s.addEventListener('input', paint);
    paint();
  });
};


me.initNavbar = function(el) {
  var tabs = el.querySelectorAll('.navbar-tab');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var which = this.dataset.id;
      tabs.forEach(function(t) { t.classList.remove('selected'); });
      el.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('selected'); });
      this.classList.add('selected');
      el.querySelectorAll('.' + which).forEach(function(t) { t.classList.add('selected'); });
    });
  });
};

me.initTooltips = function(el) {
  el.querySelectorAll('.tooltip').forEach(function(t) {
    t.addEventListener('mouseover', function() {
      if (!this.tooltip) {
        var data = readData(this, 'tooltip');
        if (!data || !data.message) return;

        var tip = fromHTML('<div class="tooltip-wrap">' + data.message + '</div>');
        document.body.appendChild(tip); // Append to body to avoid parent clipping issues
        this.tooltip = tip;

        var triggerRect = this.getBoundingClientRect();
        var tipRect = tip.getBoundingClientRect();
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

        tip.style.top = (y + scrollTop) + 'px';
        tip.style.left = (x + scrollLeft) + 'px';
        tip.style.opacity = '0';
        animateTo(tip, { opacity: '1' }, 200);
      }
    });

    t.addEventListener('mouseout', function() {
      if (this.tooltip) {
        var tip = this.tooltip;
        this.tooltip = null;
        animateTo(tip, { opacity: '0' }, 200, function() { tip.remove(); });
      }
    });
  });
};

me.initPopups = function(el) {
  el.querySelectorAll('.popupmenu').forEach(function(p) {
    p.addEventListener('click', function(event) {
      var data = readData(this, 'popup');
      if (data) {
        data.clientX = event.clientX;
        data.clientY = event.clientY;
        me.popup(data);
      }
    });
  });
};

me.closePopup = function(data, cb) {
  var el2 = resolveEl(data.selector);
  if (data && data.modal) {
    animateTo(el2, {
      left: data.clientX + 'px',
      top: data.clientY + 'px',
      width: '0px',
      height: '0px',
      opacity: '0'
    }, 300, function() {
      el2.style.display = 'none';
      // Restore original dimensions for next time
      setStyles(el2, { width: '', height: '', opacity: '1' });
      if (cb) cb();
      if (data.close) data.close();
    });
  } else {
    el2.style.display = 'none';
    if (data.close) data.close();
  }

  if (data.bg) {
    var bg = data.bg;
    fadeOut(bg, 300, function() { bg.remove(); });
  }
}

me.popup = function(data, cb) {
  var el2 = resolveEl(data.selector);
  if (!el2) {
      console.error("Popup selector not found:", data.selector);
      return;
  }

  if (data.modal) {
    var bg = data.bg = document.createElement('div');
    bg.className = 'greyedout';
    bg.style.display = 'none';
    document.body.appendChild(bg);
    fadeIn(bg, 300);

    // Correctly measure the dimensions of the hidden modal
    setStyles(el2, { position: 'absolute', visibility: 'hidden', display: 'block' });
    var w = el2.offsetWidth;
    var h = el2.offsetHeight;
    setStyles(el2, { position: '', visibility: '', display: '' }); // Reset styles

    // Set initial state for animation
    setStyles(el2, {
      display: 'block',
      position: 'fixed',
      zIndex: '15',
      width: '0px',
      height: '0px',
      top: data.clientY + 'px',
      left: data.clientX + 'px',
      opacity: '0'
    });

    var x = (window.innerWidth - w) / 2;
    var y = (window.innerHeight - h) / 2;

    // Animate to final state, including height
    animateTo(el2, {
      left: x + 'px',
      top: y + 'px',
      width: w + 'px',
      height: h + 'px',
      opacity: '1'
    }, 400, function() {
      // After animation, remove fixed width/height so it can be responsive
      setStyles(el2, { width: '', height: '' });
      if (cb) cb();
    });

  } else {
    // --- Non-Modal Popups (like context menus) ---
    // Position and display the popup off-screen to guarantee correct measurement
    setStyles(el2, {
      position: 'fixed',
      zIndex: '6',
      left: '-9999px',
      top: '-9999px',
      display: 'block',
      visibility: 'visible'
    });

    var popWidth = el2.offsetWidth;
    var popHeight = el2.offsetHeight;

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
    el2.style.left = x + 'px';
    el2.style.top = y + 'px';

    // Add a one-time click handler to the document to close the popup
    setTimeout(function() {
      document.addEventListener('click', function(e) {
        if (el2 !== e.target && !el2.contains(e.target)) {
          me.closePopup(data);
        }
      }, { once: true });
    }, 50);

    if (cb) cb();
  }

  var sel = data.closeselector ? data.closeselector : '.popupcard-close';
  var closers = typeof sel === 'string' ? el2.querySelectorAll(sel) : [sel];
  closers.forEach(function(closer) {
    // onclick assignment replaces any prior handler (the .off().on() semantics)
    closer.onclick = function() { me.closePopup(data); };
  });
};

me.prompt = function(d) {
  var val = d.value ? d.value : "";
  var sub = d.subtext ? d.subtext : "";
  var ok = d.ok ? d.ok : "ok";

  var el = fromHTML(`
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

  document.body.appendChild(el);
  d.selector = el.querySelector('.card');
  d.closeselector = el.querySelector('.close-prompt-dialog');
  d.modal = true;
  d.close = function() { el.remove(); };
  d.clientX = window.innerWidth / 2;
  d.clientY = window.innerHeight / 2;

  me.popup(d, function() {
    var input = el.querySelector('input.textinput');
    input.select();
    input.focus();
  });

  el.querySelector('.continuebutton').addEventListener('click', function() {
    var val = el.querySelector('input.textinput').value;
    if (d.validate) {
      if (d.validate(val)) {
        d.cb(val);
        me.closePopup(d);
      } else {
        el.querySelector('.subtext').style.color = "var(--error-color)";
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

    var el = fromHTML(`
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

    document.body.appendChild(el);
    d.selector = el.querySelector('.card');
    d.closeselector = '.close-prompt-dialog, .cancelbutton';
    d.modal = true;
    d.close = function() { el.remove(); };
    d.clientX = window.innerWidth / 2;
    d.clientY = window.innerHeight / 2;

    me.popup(d);

    el.querySelector('.continuebutton').addEventListener('click', function() {
        if (d.cb) d.cb(true); // Confirm true
        me.closePopup(d);
    });

    el.querySelector('.cancelbutton').addEventListener('click', function() {
        if (d.cb) d.cb(false); // Confirm false
        me.closePopup(d);
    });
};


me.initProgress = function(el) {
  el.querySelectorAll('.progressbar').forEach(function(bar) {
    bar.innerHTML = '<div class="progressbar-inner"></div>';
    bar.dataset.percent = 0;
    bar.indeterminate = false;
    bar.setProgress = function(val) {
      var progbar = this.querySelector('.progressbar-inner');
      if (val == 'indeterminate') {
        this.indeterminate = true;
        progbar.style.transition = 'all 0.8s ease-in-out';
        progbar.style.animation = 'indeterminate-progress 2s infinite linear';
        if (!document.getElementById('indeterminate-keyframes')) {
          var st = document.createElement('style');
          st.id = 'indeterminate-keyframes';
          st.textContent = '@keyframes indeterminate-progress { 0% { left: -50%; width: 50%; } 100% { left: 100%; width: 50%; } }';
          document.head.appendChild(st);
        }
      } else {
        this.indeterminate = false;
        progbar.style.animation = 'none';
        progbar.style.transition = 'width 0.3s ease';
        progbar.style.width = val + '%';
        progbar.style.left = '0%';
        this.dataset.percent = val;
      }
    };
  });
};


if (typeof componentHandler == 'undefined') componentHandler = {
  upgradeAllRegistered: function() {}
};
