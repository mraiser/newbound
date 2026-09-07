var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function() {
  var data = ME.DATA;
  var img = data.img.replace("botmanager/asset/", "app/asset/");
  loadImg(img);
  ME.querySelector(".card-title").textContent = data.name;
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
  if (!e.defaultPrevented) {
    window.lastClick = e;
    if (!ME.DATA.active) ME.querySelector('.maximize-app-icon').click();
    else window.location.href = "../" + ME.DATA.id + "/index.html";
  }
});

ME.querySelector('.maximize-app-icon').addEventListener('click', function(e) {
  e.preventDefault();
  if (!e.clientX) e = window.lastClick;
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
