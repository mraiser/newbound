var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var data = ME.DATA;
  var img = data.img.replace("botmanager/asset/", "app/asset/");
  loadImg(img);
  $(ME).find(".card-title").text(data.name);
  $(ME).find(".appcard").addClass(data.active ?"active" : "inactive").addClass("appcard-id-"+data.id);
  me.updateFilters();
};

function loadImg(img){
  var el = $("<img src='"+img+"' style='display:none;'>");
  el.load(function(){
    $(ME).find(".appcard").css("background-image", "url("+img+")").css("background-size", "cover");
  });
  $(ME).append(el);
}

me.updateFilters = function(){
  var x = 228;
  var y = 16;
  $(ME).find('.appcard.active').closest(".appcard-wrap").animate({width:x+'px',height:x+"px",margin:y+"px"},500);
  var b = $("#appfilter-inactive").prop("checked");
  var xx = b ? x : 0;
  var yy = b ? y : 0;
  $(ME).find('.appcard.inactive').closest(".appcard-wrap").animate({width:xx+'px',height:xx+"px",margin:yy+"px"},500);
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
