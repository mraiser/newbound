var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function() {
  var data = ME.DATA;
  var img = data.img.replace("botmanager/asset/", "app/asset/");
  loadImg(img);
  // The tile's keyboard target (WCAG 2.1.1): the title is a link when the
  // tile opens the app, else a button that opens its details, like a click
  // anywhere on the tile does. The name says the state the colour shows.
  var open = document.createElement(data.active ? 'a' : 'button');
  open.className = 'appcard-open';
  open.textContent = data.name;
  if (data.active) open.href = "../" + data.id + "/index.html";
  else {
    open.type = 'button';
    open.setAttribute('aria-label', data.name + (data.remote ? ', available on a connected peer' : ', inactive'));
  }
  ME.querySelector(".card-title").appendChild(open);
  ME.querySelector('.maximize-app-icon').setAttribute('aria-label', 'Details for ' + data.name);
  var card = ME.querySelector(".appcard");
  card.classList.add(data.active ? "active" : "inactive");
  card.classList.add(data.remote ? "remote" : "local");
  card.classList.add("appcard-id-" + data.id);
  me.updateFilters();
};

function loadImg(img) {
  var el = document.createElement('img');
  el.style.display = 'none';
  el.addEventListener('load', function() {
    ME.querySelector(".appcard").style.backgroundImage = "url(" + img + ")";
  });
  el.src = img;
  ME.appendChild(el);
}

me.updateFilters = function() {
  var x = 0;
  var y = 0;

  var b = false;
  if (ME.DATA.active) b = true;
  else {
    if (ME.DATA.remote) {
      if (dget("appfilter-available").checked) b = true;
    }
    else {
      if (dget("appfilter-inactive").checked) b = true;
    }
  }

  if (b) {
    x = 228;
    y = 16;
  }

  // A filtered-out tile shrinks to nothing; take it out of the tab order too.
  ME.inert = !b;

  var props = { width: x + 'px', height: x + 'px', margin: y + 'px' };
  try {
    // single-keyframe form animates from the current computed style
    var anim = ME.animate([props], { duration: 500, easing: 'ease' });
    anim.onfinish = function() { for (var k in props) ME.style[k] = props[k]; };
  } catch (xx) {
    for (var k in props) ME.style[k] = props[k];
  }
}

ME.querySelector('.appcard').addEventListener('click', function(e) {
  // The title link navigates on its own (and keeps ctrl/middle-click).
  if (e.target.closest && e.target.closest('a.appcard-open')) return;
  if (!e.defaultPrevented) {
    window.lastClick = e;
    if (!ME.DATA.active) ME.querySelector('.maximize-app-icon').click();
    else window.location.href = "../" + ME.DATA.id + "/index.html";
  }
});

ME.querySelector('.maximize-app-icon').addEventListener('click', function(e) {
  e.preventDefault();
  if (!e.clientX) e = window.lastClick;
  // From the keyboard there is no pointer: grow the dialog out of the tile.
  if (!e || !e.clientX) {
    var r = ME.getBoundingClientRect();
    e = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  }
  var d = {"selector":".app-settings", "closeselector":".close-app-settings", "modal":true};
  d.clientX = e.clientX;
  d.clientY = e.clientY;
  document.body.api.closedata = d;
  document.body.api.ui.popup(d, function() {
    var dlg = document.querySelector(d.selector);
    dlg.style.width = "90vw";
    dlg.style.height = "90vh";
    dlg.style.left = "5vw";
  });
  var el = dget('app-settings');
  el.querySelector('.appname').textContent = ME.DATA.name;
  installControl(el.querySelector('.appinfo'), 'app', 'appinfo', function(api) {}, ME.DATA);
});
