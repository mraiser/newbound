var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var data = ME.DATA;
  var img = data.img.replace("botmanager/asset/", "app/asset/");
  loadImg(img);
  $(ME).find(".card-title").text(data.name);
  $(ME).find(".appcard").addClass(data.active ? "active" : "inactive").addClass(data.remote ? "remote" : "local").addClass("appcard-id-"+data.id);
  me.updateFilters();
};

function loadImg(img){
  var el = $("<img src='"+img+"' style='display:none;'>");
  el.on('load', function(){
    $(ME).find(".appcard").css("background-image", "url("+img+")").css("background-size", "cover");
  });
  $(ME).append(el);
}

me.updateFilters = function(){
  var x = 0;
  var y = 0;
  
  var b = false;
  if (ME.DATA.active) b = true;
  else {
    if (ME.DATA.remote) {
      if ($("#appfilter-available").prop("checked")) b = true;
    }
    else {
      if ($("#appfilter-inactive").prop("checked")) b = true;
    }
  }
  
  if (b) {
    x = 228;
    y = 16;
  }
  
  $(ME).animate({width:x+'px',height:x+"px",margin:y+"px"},500);
}

$(ME).find('.appcard').click(function(e){
  if (!e.isDefaultPrevented()) {
    window.lastClick = e;
    if (!ME.DATA.active) $(ME).find('.maximize-app-icon').click();
    else window.location.href = "../"+ME.DATA.id+"/index.html";
  }
});

$(ME).find('.maximize-app-icon').click(function(e){
  e.preventDefault();
  if (!e.clientX) e = window.lastClick;
  var d = {"selector":".app-settings", "closeselector":".close-app-settings", "modal":true};
  d.clientX = e.clientX;
  d.clientY = e.clientY;
  document.body.api.closedata = d;
  document.body.api.ui.popup(d, function(){
    $(d.selector).css("width","90vw").css("height","90vh").css("left","5vw");
  });
  var el = $('#app-settings');
  el.find('.appname').text(ME.DATA.name);
  el = el.find('.appinfo');
  installControl(el[0], 'app', 'appinfo', function(api){}, ME.DATA);
});
