var me = this;
var ME = $('#'+me.UUID)[0];

if (!ME.DATA.cb) ME.DATA.cb = function(val){
  alert(val);
};

if (!ME.DATA.validate) ME.DATA.validate = function(val){
  return val.length>0;
};

me.ready = function(){
  componentHandler.upgradeAllRegistered();

  if (ME.DATA.title) $(ME).find('.mdl-card__title-text').text(ME.DATA.title);
  if (ME.DATA.text) $(ME).find('.subtext').text(ME.DATA.text);
  if (ME.DATA.ok) $(ME).find('.continuebutton').text(ME.DATA.ok);
  if (ME.DATA.cancel) $(ME).find('.cancelbutton').text(ME.DATA.cancel);
  
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
      
      var progress = $(ME).find('.mdl-progress');
      progress.addClass('mdl-progress__indeterminate');
      
      var f = $(ME).find('#sample3')[0];
      var n = f.files.length;
      var i = 0;
      
      function popNext(){
        var file = f.files[i++];
        if (file) {
          var name = ME.DATA.rename ? guid() : file.name;
          var formData = new FormData();
          formData.append("file", file);
          formData.append("name", name);
          formData.append("originalname", file.name);

          var xhr = new XMLHttpRequest();
          xhr.open('POST', '../botmanager/asset?db='+encodeURIComponent(ME.DATA.lib), true);
          xhr.onload = function (val) {
            var response = JSON.parse(val.currentTarget.response);
            console.log("RESPONSE: "+val.currentTarget.response);
            if (response.status != 'ok'){
              alert('Unable to upload: '+response.msg);
            }
            else {
              ME.DATA.cb(name);
              $(ME).find('.dbg').animate({width:'0px',height:'0px'},500);
              $(ME).find('.greyedout').css('display', 'none');
              
            }
          };
          
          xhr.upload.addEventListener("progress", function(e) {
            progress.removeClass('mdl-progress__indeterminate');
            var pc = e.loaded / e.total * 100;
            progress[0].MaterialProgress.setProgress(pc);
          }, false);    
          
          xhr.send(formData);
        }
      }
      popNext();
    }
  });
  
  if (ME.DATA.validate) {
    $(ME).on('change','#sample3' , validate);
    validate();
  }
};

function validate(){
  var isok = ME.DATA.validate($(ME).find('#sample3').val());
  if (isok) $(ME).find('.continuebutton').removeAttr('disabled').removeClass('mdl-button--disabled');
  else $(ME).find('.continuebutton').attr("disabled", "disabled").addClass('mdl-button--disabled');
}

var upd = $(ME).find('.dialog-card-wide');
var pubg = upd;

upd.on('dragover', function(e){
  e.preventDefault();  
  e.stopPropagation();
  pubg.addClass('bggreen');
});
upd.on('dragenter', function(e){
  e.preventDefault();  
  e.stopPropagation();
  pubg.addClass('bggreen');
});
upd.on('dragleave', function(e){
  e.preventDefault();  
  e.stopPropagation();
  pubg.removeClass('bggreen');
});
upd.on('drop', function(e){
  e.preventDefault();  
  e.stopPropagation();
  pubg.removeClass('bggreen');
  $(ME).find('#sample3')[0].files = e.originalEvent.dataTransfer.files;
  var isok = ME.DATA.validate(e.originalEvent.dataTransfer.files[0].name);
  if (isok) {
    ME.DATA.validate = null;
    $(ME).find('.continuebutton').click();
  }
});
