var me = this;
var ME = $('#'+me.UUID)[0];

var prefix = typeof CURRENTDEVICEID == 'string' ? '../peerbot/remote/'+CURRENTDEVICEID+'/' : '../';
var cbs = [];

me.ready = function(){
  //componentHandler.upgradeAllRegistered();
  
  var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';

  function validateString(val){
    if (val.length == 0) return false;
    var i = val.length;
    while (i-->0) if (validchars.indexOf(val.charAt(i)) == -1) return false;
    return true;
  }

  $.getJSON(prefix + 'metabot/libraries', function(result){
    if (result.data.data) result.data = result.data.data;
    me.list = result.data.list;
    sortLibs();
    
    rebuild();

    if (ME.DATA.cb) me.change(ME.DATA.cb);
    
    var aa = ME.DATA.allowadd ? true : false;
    if (aa){
      $(ME).find('.addlib').css('display', 'block').click(function(){
        var data = {
          title:'New Library',
          text:'New library name',
          subtext:'lowercase letters, numbers, and underscores only.',
          cancel:'cancel',
          ok:'create',
          validate:validateString,
          cb: function(val){
            json(prefix + 'botmanager/newdb', 'db='+encodeURIComponent(val)+'&readers='+encodeURIComponent(JSON.stringify(["anonymous"])), function(result){
              json(prefix + 'botmanager/write', 'id=tasklists&data=%7B%7D&db='+encodeURIComponent(val), function(result){
                me.list.unshift(val);
                me.value = val;
                rebuild();
                for (var i in cbs) cbs[i](val);
              });
            });
          }
        };
        installControl($(ME).find('.dialogdiv')[0], 'metabot', 'promptdialog', function(){}, data);
      });    

    }
  });
};

function sortLibs(){
  me.list.sort(function(a,b) {return (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0);} ); 
}  

function rebuild(){
  var l = ME.DATA.label ? ME.DATA.label : 'Select a Library';
  var a = ME.DATA.allownone ? true : false;

  var data = {
    label: l,
    list: me.list,
    value: ME.DATA.value,
    allownone:a,
    cb:function(val){
      for (var i in cbs) cbs[i](val);
    },
    ready:function(api){
      if (ME.DATA.ready) ME.DATA.ready(me);
    }
  };

  installControl($(ME).find('.libselwrap')[0], 'metabot', 'select', function(api){}, data);
}

me.change = function(cb){
  cbs.push(cb);
};

me.value = function(){
  return $(ME).find('select').val();
};
