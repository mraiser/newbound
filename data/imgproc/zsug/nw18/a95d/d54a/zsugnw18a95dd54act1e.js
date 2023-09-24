var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  
//  send_mp4_to_png(function(result){
//    send_extract_faces(1, function(result){
//      send_index_faces(16, function(result){
//        send_pull_good(function(result){
//          console.log(result);
//        });
//      });
//    });
//  });
  
  send_prepare_dataset(function(result){ console.log(result); }); 
  
//  send_classify(function(result){ console.log(result); });
};
