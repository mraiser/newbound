var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  send_list_segments(function(result){
    for (var i in result.data) {
      var d = result.data[i];
      
      var wrap = $("<div class='inline segment'/>");
      wrap.data("meta", d);
      
      var img = $("<img width='512' class='segimg'>");
      img.prop('src', d.img);
      $(wrap).append(img);
      
      var right = $("<div class='inline'/>");
      $(wrap).append(right);
      
      var newhtml = '<audio controls><source src="'+d.wav+'" type="audio/wav">???</audio><br>';
      $(right).append(newhtml);
      
      var ta = $('<textarea/>');
      ta.text(d.prompt);
      $(right).append(ta);
      
      var butt = $("<button class='accentbutton'>replace</button>");
      butt.click(replace);
      $(right).append(butt);
      
      $(ME).append(wrap);
    }
  });
};

function replace(){
  var el = $(this).closest(".segment");
  var d = el.data("meta");
  d.prompt = el.find('textarea').val();
  el = el.find('.segimg');
  el.prop('src', '../chuckme/wait/'+(Date.now() % 6)+".png");
  send_generate(d.prompt, d.id, function(result){
    el.prop('src', d.img+"?x="+guid());
  });
}