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

function reducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (x) { return false; }
}

function animateTo(el, props, ms, cb) {
  var done = function() { setStyles(el, props); if (cb) cb(); };
  // The OS asks for reduced motion: go straight to the end state.
  if (reducedMotion()) { done(); return; }
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

// Keyboard access for an element that can't be a <button> (a table row or
// cell): focusable, exposed as a button, and Enter or Space fires its click
// handler (WCAG 2.1.1, 4.1.2). Prefer a real <button> wherever one fits.
me.pressable = function(el, label) {
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  if (label) el.setAttribute('aria-label', label);
  el.addEventListener('keydown', function(e) {
    if (e.target !== el) return;
    if (e.key == 'Enter' || e.key == ' ') { e.preventDefault(); el.click(); }
  });
};

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

// --- Status messages (WCAG 4.1.3) ---
// Two persistent, visually hidden live regions announce messages: polite for
// status, assertive for errors. They are created once and reused, so every
// message fires, and dialogs never make them inert (see inertOutside).
function liveRegion(kind) {
  var r = document.querySelector('.nb-live-' + kind);
  if (!r) {
    r = document.createElement('div');
    r.className = 'nb-live nb-sr-only nb-live-' + kind;
    r.setAttribute('role', kind == 'alert' ? 'alert' : 'status');
    r.setAttribute('aria-live', kind == 'alert' ? 'assertive' : 'polite');
    r.setAttribute('aria-atomic', 'true');
    document.body.appendChild(r);
  }
  return r;
}

// Say msg to assistive tech without showing anything.
me.announce = function(msg, assertive) {
  var r = liveRegion(assertive ? 'alert' : 'status');
  r.textContent = '';
  // a new text node after a beat, so the same message twice is heard twice
  setTimeout(function() { r.textContent = msg; }, 60);
};

// data: message (HTML), kind ('error' announces assertively), actionText +
// actionHandler (a real button), timeout, width. The bar stays while it is
// hovered or has focus (WCAG 2.2.1); with an action it stays at least 6 s.
me.snackbar = function(data) {
  if (me.snacking) {
    me.snacks.push(data);
  } else {
    me.snacking = true;
    var bar = fromHTML('<div class="snackbar"><div class="snackbar-inner">' + data.message + '</div></div>');
    bar.style.fontFamily = 'var(--font-family)';
    var inner = bar.querySelector('.snackbar-inner');
    me.announce(inner.textContent.trim(), data.kind == 'error');

    if (data.actionHandler) {
      var action = document.createElement('button');
      action.type = 'button';
      action.className = 'snackbar-action';
      action.textContent = data.actionText;
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
    if (data.actionHandler) timeout = Math.max(timeout, 6000);

    var timer = null, held = 0, left = timeout, started = Date.now();
    function hide() {
      timer = null;
      animateTo(bar, { bottom: '-100px' }, 500, function() {
        bar.remove();
        me.snacking = false;
        if (me.snacks.length > 0)
          me.snackbar(me.snacks.shift());
      });
    }
    function hold() {
      if (held++ == 0 && timer) { clearTimeout(timer); timer = null; left -= Date.now() - started; }
    }
    function release() {
      if (held > 0 && --held == 0 && bar.isConnected) { started = Date.now(); timer = setTimeout(hide, Math.max(left, 1500)); }
    }
    bar.addEventListener('mouseenter', hold);
    bar.addEventListener('mouseleave', release);
    bar.addEventListener('focusin', hold);
    bar.addEventListener('focusout', function(e) { if (!bar.contains(e.relatedTarget)) release(); });
    timer = setTimeout(hide, timeout);
  }
};

// --- Field errors (WCAG 3.3.1, 1.4.1, 4.1.2) ---
// fieldError(input, msg, opts) shows msg as text under the field (or where
// opts.into / opts.after say), with an icon, marks the input aria-invalid and
// points its aria-describedby at the message, which is announced (role=alert).
// clearFieldError(input) undoes it. The snackbar is never the only place a
// form error shows.
var ERR_ICON = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

function describedBy(input, id, on) {
  var ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(function(x) { return x && x != id; });
  if (on) ids.push(id);
  if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
  else input.removeAttribute('aria-describedby');
}

me.fieldError = function(input, msg, opts) {
  opts = opts || {};
  if (!input.id) input.id = uid('field');
  var id = input.id + '-err';
  var err = document.getElementById(id);
  if (!err) {
    err = document.createElement('div');
    err.id = id;
    err.className = 'nb-field-err' + (opts.className ? ' ' + opts.className : '');
    err.setAttribute('role', 'alert');
    if (opts.into) resolveEl(opts.into).appendChild(err);
    else (opts.after ? resolveEl(opts.after) : input).insertAdjacentElement('afterend', err);
  }
  err.innerHTML = ERR_ICON;
  var t = document.createElement('span');
  t.textContent = msg;
  err.appendChild(t);
  err.hidden = false;
  input.setAttribute('aria-invalid', 'true');
  describedBy(input, id, true);
  if (opts.focus !== false && document.activeElement !== input) input.focus();
  return err;
};

me.clearFieldError = function(input) {
  if (!input) return;
  input.removeAttribute('aria-invalid');
  if (!input.id) return;
  var err = document.getElementById(input.id + '-err');
  if (err) { err.hidden = true; err.textContent = ''; }
  describedBy(input, input.id + '-err', false);
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
  // One tablist per tab bar in el.
  var bars = [];
  tabs.forEach(function(t) { if (bars.indexOf(t.parentElement) < 0) bars.push(t.parentElement); });
  bars.forEach(function(bar) {
    me.ariaTabs(bar, function(t) { return el.querySelector('.tab-content.' + t.dataset.id); });
  });
};

// Tabs as the ARIA tab pattern (WCAG 2.1.1, 4.1.2): the bar is a tablist,
// each .navbar-tab a tab (only the selected one in the tab order), its
// content a tabpanel; Left/Right/Home/End move and select. Selection itself
// stays with the page's own click handler: a key press clicks the tab.
// panelFor(tab) returns that tab's content element, or null.
me.ariaTabs = function(bar, panelFor) {
  var tabs = Array.prototype.slice.call(bar.querySelectorAll(':scope > .navbar-tab'));
  if (tabs.length == 0) return;
  bar.setAttribute('role', 'tablist');
  function sync(sel) {
    tabs.forEach(function(t) {
      var on = sel ? t === sel : t.classList.contains('selected');
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
  }
  tabs.forEach(function(t) {
    t.setAttribute('role', 'tab');
    if (!t.id) t.id = uid('tab');
    var p = panelFor ? panelFor(t) : null;
    if (p) {
      if (!p.id) p.id = uid('tabpanel');
      t.setAttribute('aria-controls', p.id);
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', t.id);
    }
    t.addEventListener('click', function() { sync(t); });
    t.addEventListener('keydown', function(e) {
      var i = tabs.indexOf(t), n = tabs.length, j = -1;
      if (e.key == 'ArrowRight') j = (i + 1) % n;
      else if (e.key == 'ArrowLeft') j = (i - 1 + n) % n;
      else if (e.key == 'Home') j = 0;
      else if (e.key == 'End') j = n - 1;
      else if (e.key == 'Enter' || e.key == ' ') { e.preventDefault(); t.click(); return; }
      if (j < 0) return;
      e.preventDefault();
      tabs[j].focus();
      tabs[j].click();
    });
  });
  sync();
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

// --- Dialog and menu accessibility (WCAG 2.1.1, 2.1.2, 2.4.3, 4.1.2) ---
// A modal popup is announced as a dialog with a name, takes focus when it
// opens, keeps Tab inside (everything else is inert), closes on Escape the
// way its own close control does, and hands focus back to whatever opened it.
var FOCUSABLE = 'a[href], summary, iframe, button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
var uidN = 0;
function uid(prefix) { return prefix + '-' + me.UUID + '-' + (++uidN); }

function shown(x) {
  return x.getClientRects().length > 0 && getComputedStyle(x).visibility != 'hidden';
}

function focusables(el) {
  return Array.prototype.filter.call(el.querySelectorAll(FOCUSABLE), function(x) {
    return shown(x) && !(x.closest && x.closest('[inert]'));
  });
}

function closersOf(el2, data) {
  var sel = data.closeselector ? data.closeselector : '.popupcard-close';
  return typeof sel === 'string' ? Array.prototype.slice.call(el2.querySelectorAll(sel)) : [sel];
}

// The dialog's name: data.label, an existing aria-label(ledby), else its title.
var TITLE_SELECTORS = ['[data-dialog-title]', '.peer-dlg-title', '.hud-dlg-title', '.usercard-title', '.appname',
  '.dialog-header .title', '.card-header .title', '.title', '.dialog-header', '.card-header'];
function nameDialog(el2, data) {
  if (data.label) { el2.setAttribute('aria-label', data.label); el2.removeAttribute('aria-labelledby'); return; }
  if (el2.hasAttribute('aria-labelledby') || el2.hasAttribute('aria-label')) return;
  for (var i = 0; i < TITLE_SELECTORS.length; i++) {
    var t = el2.querySelector(TITLE_SELECTORS[i]);
    if (t && t.textContent.trim()) {
      if (!t.id) t.id = uid('dlg-title');
      el2.setAttribute('aria-labelledby', t.id);
      return;
    }
  }
}

// Everything outside the dialog becomes inert, except data.keepLive
// elements a page keeps clickable above its backdrop (Settings' gear).
// Returns what was changed.
function inertOutside(el2, keep) {
  var live = [el2].concat(keep || []).filter(function(x) { return x && x.isConnected; });
  var path = [];
  live.forEach(function(x) {
    for (var n = x.parentElement; n && n !== document.documentElement; n = n.parentElement)
      if (path.indexOf(n) < 0) path.push(n);
  });
  var changed = [];
  path.forEach(function(p) {
    Array.prototype.forEach.call(p.children, function(c) {
      if (path.indexOf(c) >= 0 || live.indexOf(c) >= 0 || c.inert) return;
      if (c.tagName == 'SCRIPT' || c.tagName == 'STYLE' || c.tagName == 'LINK') return;
      if (c.classList.contains('nb-live')) return;   // announcements keep working
      c.inert = true;
      changed.push(c);
    });
  });
  return changed;
}

// Focus on open: data.focus, then [autofocus], the first field, a close
// control, the first focusable, and last the dialog itself.
function focusInto(el2, data) {
  if (!shown(el2) || el2.contains(document.activeElement)) return;
  var pick = data.focus ? resolveEl(data.focus) : null;
  if (!pick || !shown(pick)) pick = el2.querySelector('[autofocus]');
  var all = focusables(el2);
  if (!pick || !shown(pick)) pick = all.filter(function(x) {
    return x.matches('select, textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"])');
  })[0];
  if (!pick) pick = closersOf(el2, data).filter(shown)[0];
  if (!pick) pick = all[0];
  if (!pick) { if (!el2.hasAttribute('tabindex')) el2.tabIndex = -1; pick = el2; }
  pick.focus({ preventScroll: true });
}

// Controls a page draws above its own backdrop (the titlebar's home link and
// gear) stay clickable with the mouse, as they were; Tab still stays inside.
function aboveBackdrop(el2) {
  var keep = [];
  document.querySelectorAll(FOCUSABLE).forEach(function(x) {
    if (el2.contains(x) || !shown(x)) return;
    var r = x.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx >= window.innerWidth || cy >= window.innerHeight) return;
    var h = document.elementFromPoint(cx, cy);
    if (h && (h === x || x.contains(h))) keep.push(x);
  });
  return keep;
}

function openModalA11y(el2, data) {
  if (!el2.hasAttribute('role') || data.role) el2.setAttribute('role', data.role || 'dialog');
  el2.setAttribute('aria-modal', 'true');
  nameDialog(el2, data);
  var keep = (data.keepLive || []).map(resolveEl).concat(data.bg ? aboveBackdrop(el2) : []);
  var st = { data: data, el: el2, opener: document.activeElement, inerted: inertOutside(el2, keep) };
  el2._nbModal = st;
  me.modals.push(st);
}

function closeModalA11y(el2) {
  var st = el2 && el2._nbModal;
  if (!st) return;
  el2._nbModal = null;
  var i = me.modals.indexOf(st);
  if (i >= 0) me.modals.splice(i, 1);
  st.inerted.forEach(function(x) { x.inert = false; });
  // Back to the opener, unless focus already moved somewhere live outside.
  var ae = document.activeElement;
  var lost = !ae || ae === document.body || el2.contains(ae);
  var to = st.data.returnFocus ? resolveEl(st.data.returnFocus) : st.opener;
  if (lost && to && to !== document.body && to.isConnected && shown(to) && !(to.closest && to.closest('[inert]')))
    to.focus({ preventScroll: true });
}

me.modals = [];
me.menu = null;   // the open non-modal popup (menus), if any

document.addEventListener('keydown', function(e) {
  if (e.isComposing || e.defaultPrevented) return;
  // An open menu takes Escape first (also when it sits inside a dialog).
  if (e.key == 'Escape' && me.menu) {
    var m = me.menu;
    if (shown(m.el)) {
      e.preventDefault();
      me.closePopup(m.data);
      if (m.trigger && m.trigger.isConnected) m.trigger.focus({ preventScroll: true });
      return;
    }
    me.menu = null;
  }
  var top = me.modals[me.modals.length - 1];
  if (!top) return;
  if (e.key == 'Escape' && !top.data.noEscape && !(e.target && e.target.tagName == 'SELECT')) {
    e.preventDefault();
    if (typeof top.data.escape == 'function') top.data.escape();
    else {
      var c = closersOf(top.el, top.data).filter(shown)[0];
      if (c) c.click(); else me.closePopup(top.data);
    }
  } else if (e.key == 'Tab') {
    // Wrap Tab inside the dialog (inert covers the rest; this keeps focus
    // off the browser chrome and works where inert is missing).
    var f = focusables(top.el);
    if (f.length == 0) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1];
    if (!top.el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// Safety net: a page that hides or removes a modal itself, without
// closePopup(), must not leave everything else inert (inert blocks the
// mouse too).
setInterval(function() {
  me.modals.slice().forEach(function(st) {
    if (!st.el.isConnected || !shown(st.el)) closeModalA11y(st.el);
  });
}, 400);

me.initPopups = function(el) {
  el.querySelectorAll('.popupmenu').forEach(function(p) {
    var d0 = readData(p, 'popup');
    if (d0 && !d0.modal) {
      p.setAttribute('aria-haspopup', 'true');
      p.setAttribute('aria-expanded', 'false');
    }
    p.addEventListener('click', function(event) {
      var data = readData(this, 'popup');
      if (data) {
        data.clientX = event.clientX;
        data.clientY = event.clientY;
        data.trigger = this;
        // A keyboard click has no pointer position: open at the trigger.
        if (!event.clientX && !event.clientY) {
          var r = this.getBoundingClientRect();
          data.clientX = r.left + r.width / 2;
          data.clientY = data.modal ? r.top + r.height / 2 : r.bottom;
          data.byKeyboard = true;
        }
        me.popup(data);
      }
    });
  });
};

me.closePopup = function(data, cb) {
  var el2 = resolveEl(data.selector);
  if (data && data.modal) {
    // Already closing (a ✕ can be wired to close twice): nothing more to do.
    if (data.closed) return;
    // Mark closed first, so an open still animating won't attach re-centring after this
    data.closed = true;
    closeModalA11y(el2);
    // Stop re-centring before the close animation starts, so they don't fight it
    if (data.resizeObserver) { data.resizeObserver.disconnect(); data.resizeObserver = null; }
    if (data.reflow) { window.removeEventListener('resize', data.reflow); data.reflow = null; }
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
    if (data.trigger) data.trigger.setAttribute('aria-expanded', 'false');
    if (me.menu && me.menu.data === data) me.menu = null;
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
    data.closed = false;
    var bg = data.bg = document.createElement('div');
    bg.className = 'greyedout';
    bg.style.display = 'none';
    // A dialog opened over another (a confirm over Edit user): its backdrop
    // and card stack above the open one, so the one below is dimmed too.
    var depth = me.modals.length;
    if (depth) bg.style.zIndex = String(14 + 2 * depth);
    document.body.appendChild(bg);
    fadeIn(bg, 300);
    openModalA11y(el2, data);

    // Correctly measure the dimensions of the hidden modal
    setStyles(el2, { position: 'absolute', visibility: 'hidden', display: 'block' });
    var w = el2.offsetWidth;
    var h = el2.offsetHeight;
    setStyles(el2, { position: '', visibility: '', display: '' }); // Reset styles

    // Set initial state for animation
    setStyles(el2, {
      display: 'block',
      position: 'fixed',
      zIndex: depth ? String(15 + 2 * depth) : '15',
      width: '0px',
      height: '0px',
      top: data.clientY + 'px',
      left: data.clientX + 'px',
      opacity: '0'
    });

    var x = Math.max(16, (window.innerWidth - w) / 2);
    var y = Math.max(16, (window.innerHeight - h) / 2);

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
      // Keep the card on screen and centred as it grows or the window resizes.
      // Skip when it was closed again before this open finished.
      if (!data.closed) {
        data.reflow = function() {
          el2.style.left = Math.max(16, (window.innerWidth - el2.offsetWidth) / 2) + 'px';
          el2.style.top = Math.max(16, (window.innerHeight - el2.offsetHeight) / 2) + 'px';
        };
        data.resizeObserver = new ResizeObserver(data.reflow);
        data.resizeObserver.observe(el2);
        window.addEventListener('resize', data.reflow);
        data.reflow();
        focusInto(el2, data);
      }
      if (cb) cb();
    });

  } else {
    // --- Non-Modal Popups (like context menus) ---
    // Position and display the popup off-screen to guarantee correct measurement
    setStyles(el2, {
      position: 'fixed',
      zIndex: '20',
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

    me.menu = { data: data, el: el2, trigger: data.trigger };
    if (data.trigger) data.trigger.setAttribute('aria-expanded', 'true');
    // Opened from the keyboard: move into the menu.
    if (data.byKeyboard) { var f0 = focusables(el2)[0]; if (f0) f0.focus({ preventScroll: true }); }

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
          <button type="button" class="popupcard-close close-prompt-dialog" aria-label="Close">
             <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="pad16">
          <label class="textinputlabel" for="prompt-input-${me.UUID}">${d.text}</label>
          <input class="textinput" type="text" id="prompt-input-${me.UUID}" value="${val}">
        </div>
        <div class="subtext card-description pad16" style="padding-top:0;">${sub}</div>
        <div class="card-button-wrap">
          <button type="button" class="continuebutton coloredbutton">${ok}</button>
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

  el.querySelector('input.textinput').addEventListener('keydown', function(e) {
    if (e.key == 'Enter') { e.preventDefault(); el.querySelector('.continuebutton').click(); }
  });

  el.querySelector('.continuebutton').addEventListener('click', function() {
    var val = el.querySelector('input.textinput').value;
    if (d.validate) {
      if (d.validate(val)) {
        d.cb(val);
        me.closePopup(d);
      } else {
        // Say what is wrong, as text (d.error, else the hint), not by colour only.
        var sub = el.querySelector('.subtext');
        sub.style.color = "var(--error-color)";
        if (!sub.id) sub.id = uid('prompt-err');
        sub.setAttribute('role', 'alert');
        var why = d.error || sub.textContent || 'Check this value.';
        sub.textContent = '';
        setTimeout(function() { sub.textContent = why; }, 60);
        var inp = el.querySelector('input.textinput');
        inp.setAttribute('aria-invalid', 'true');
        describedBy(inp, sub.id, true);
        inp.focus();
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
                 <button type="button" class="popupcard-close close-prompt-dialog" aria-label="Close">
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                 </button>
            </div>
            <div class="subtext card-description pad16">${text}</div>
            <div class="card-button-wrap">
                <button type="button" class="cancelbutton regularbutton">${cancel}</button>
                <button type="button" class="continuebutton coloredbutton">${ok}</button>
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
    // A confirmation is an alertdialog described by its text; focus starts
    // on Cancel (the safe choice) and Escape means Cancel.
    d.role = 'alertdialog';
    var txt = el.querySelector('.subtext');
    txt.id = uid('dlg-text');
    d.selector.setAttribute('aria-describedby', txt.id);
    if (!d.focus) d.focus = el.querySelector('.cancelbutton');
    if (!d.escape) d.escape = function() { el.querySelector('.cancelbutton').click(); };

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
