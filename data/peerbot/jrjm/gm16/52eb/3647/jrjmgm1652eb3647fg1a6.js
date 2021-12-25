var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  if (document.peers) build();
  else fetch();
};
  
function fetch(){
  json('../peerbot/connections', null, function(result){
    document.peers = result.data;
    build();
  });
};

function build(){
  var el = $(ME).find('.peerselector')[0];

  var data = ME.DATA;
  if (!data) data = {};
  var list = [];
  for (var i in document.peers) {
    if (!data.connectedonly || document.peers[i].connected)
      list.push(document.peers[i]);
  }
  if (!data.label) data.label = 'Select Peer';
  if (data.local) {
    var l = {
      "name": "(local)",
      "id": "local"
    };
    list.unshift(l);
  }
  data.list = list;
    
  installControl(el, 'metabot', 'select', function(api){}, data);
};
