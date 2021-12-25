var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  componentHandler.upgradeAllRegistered();
  
  me.storedb = ME.DATA.storedb;
  me.storeid = ME.DATA.storeid;
  
  var data = {
    allownone:ME.DATA.allownone,
    allowadd:ME.DATA.allowadd,
    lib:ME.DATA.lib,
    cb:function(val){
//      alert(val);
    },
    ready:function(api){
//      alert(api.value());
    }
  };
  installControl($(ME).find('.assetselect')[0], 'metabot', 'assetselect', function(api){
   me.picker = api;
  }, data);
  
  if (me.storedb){
    json('../botmanager/read', 'db='+me.storedb+'&id='+me.storeid, function(result){
      me.list = result.data ? result.data.list : [];
      rebuild();
    });
  }
  else{
    me.list = ME.DATA.list ? ME.DATA.list : [];
    rebuild();
  }
};

function rebuild(){
  var list = me.list;
  var newhtml = '<ul class="demo-list-icon mdl-list">';
  for (var i in list){
    newhtml += '<li class="mdl-list__item"><span class="mdl-list__item-primary-content"><i class="deleteasset material-icons mdl-list__item-icon" data-index="'+i+'" >delete</i>'+list[i]+'</span></li>';
  }
  newhtml += '</ul>';
  $(ME).find('.assetlist').html(newhtml).find('.deleteasset').click(function(){
    me.list.splice($(this).data('index'),1);
    save();
  });
  componentHandler.upgradeAllRegistered();
}

$(ME).find('.addassetbutton').click(function(){
  var lib = me.picker.lib;
  var ass = me.picker.value();
  me.list.push(lib+':'+ass);
  save();
});

function save(){
  if (me.storedb){
    var data = { list: me.list };
    json('../botmanager/write', 'db='+me.storedb+'&id='+me.storeid+'&data='+encodeURIComponent(JSON.stringify(data)), function(result){ 
      rebuild();
    });  
  }
  else rebuild();
  if (ME.DATA.cb) ME.DATA.cb(me.list);
}

$(document).click(function(event) {
   window.lastElementClicked = event.target;
});
