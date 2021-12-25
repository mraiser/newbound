var me = this;
var ME = $('#'+me.UUID)[0];

var cbs = [];
var lib = me.lib = ME.DATA.lib;
if (!lib) {
  var val = ME.DATA.value;
  if (val){
    var i = val.indexOf(':');
    if (i>0){
      lib = me.lib = val.substring(0,i);
      me.selectedasset = val.substring(i+1);
    }
  }
}

me.ready = function(){
  var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';

  function validateString(val){
    if (val.length == 0) return false;
    var i = val.length;
    while (i-->0) if (validchars.indexOf(val.charAt(i)) == -1) return false;
    return true;
  }
  
  function libselcallback(val, ocb){
    if (val){
      lib = me.lib = ME.DATA.lib = val;
      rebuild();
    }
  }
  
  if (ME.DATA.lib) libselcallback(ME.DATA.lib);
  else{
    function libselready(api){
      libselcallback(api.value())
    }

    var data = {
      allowadd:ME.DATA.allowadd,
      allownone:ME.DATA.allownone,
      value: lib,
      ready: libselready,
      cb: libselcallback
    };

    var el = $(ME).find('.libraryselect');
    installControl(el[0], 'metabot', 'libraryselect', function(){}, data);
  }

  rebuild();

  if (ME.DATA.cb) me.change(ME.DATA.cb);

  var aa = ME.DATA.allowadd ? true : false;
  if (aa) {
    setTimeout(function(){
      $(ME).find('.addass').css('display', 'block').click(function(){
        var data = {
          lib:me.lib,
          validate:function(val){
            if (val.length == 0) return false;
            return true;
          },
          cb: function(val){
            ME.DATA.value = val;
            var ctl = { name: val, id: val };

            if (!me.assets) me.assets = {};
            if (!me.assets.list) me.assets.list = [];
            me.assets.list.push(ctl);
            saveAssets(function(){
//              $(ME).find('.assetselect').find('select').val(val);
              rebuild();
            });
          }
        };
        var eid = guid();
        var el = $('<div id="'+eid+'" class="uploadassetdialogdiv"></div>')[0];
        $('body').append(el);
        installControl(el, 'metabot', 'uploaddialog', function(){}, data);
      });
    }, 1000);
  }
};

function sortAssets(){
  me.list.sort(function(a,b) {return (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : ((b.name.toLowerCase() > a.name.toLowerCase()) ? -1 : 0);} ); 
}  

function rebuild(){
  json('../botmanager/read', 'db='+lib+'&id=assets', function(result){
    var alist = result.data ? result.data.list : [];
    me.list = alist;
    sortAssets();
    me.assets = { list:me.list };

    var l = ME.DATA.label ? ME.DATA.label : 'Select an Asset';
    var a = ME.DATA.allownone ? true : false;
    var data = {
      label: l,
      list: me.list,
      value:me.selectedasset,
      allownone:a,
      cb:function(val){
        for (var i in cbs) cbs[i](val);
      },
      ready:function(api){
        if (ME.DATA.ready) ME.DATA.ready(me);
      }
    };

    installControl($(ME).find('.assetselwrap')[0], 'metabot', 'select', function(api){}, data);
  });
}

me.change = function(cb){
  cbs.push(cb);
};

me.value = function(){
  return $(ME).find('.assetselwrap').find('select').val();
};

function saveAssets(cb){
  debugger;
  var ctl = me.assets;
  var readers = [ "anonymous" ];
  json('../botmanager/write', 'db='+encodeURIComponent(me.lib)+'&id=assets&readers='+encodeURIComponent(JSON.stringify(readers))+'&data='+encodeURIComponent(JSON.stringify(ctl)), function(result){
    if (result.status != 'ok') alert(result.msg);
    else {
      rebuild();
    }
  });
}

