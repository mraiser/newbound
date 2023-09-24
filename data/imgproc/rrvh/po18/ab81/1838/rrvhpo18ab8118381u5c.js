var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  send_extract_frames("/export/train/batch/src/Blame The Weatherman [W-Uekxu-AuA].mp4", "/export/train/batch/work", function(result){
    console.log(result);
  });
};
