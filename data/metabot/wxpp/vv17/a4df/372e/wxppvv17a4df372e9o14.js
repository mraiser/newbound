var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(api){
  componentHandler.upgradeAllRegistered();
  
  var list = me.list = ME.DATA.behaviors;
  rebuildBehaviors();
};

me.dirty = function(){
  me.parent.dirty();
};

function rebuildBehaviors(){
  var list = me.list;
  var el = $(ME).find('.blist');
  var newhtml = null;
  if (list.length == 0) newhtml = '<i>No behaviors defined</i><br><br>';
  else{
    newhtml = '<ul class="demo-list-behavior mdl-list">';
    for (var i in list){
      var ctl = list[i];
      var name = ctl.name ? ctl.name : ctl.id;
      var params = '';
      for (var j in ctl.params){
        if (j != 0) params += ', ';
        params += ctl.params[j].name;
      }
      newhtml += '<li class="mdl-list__item mdl-list__item--one-line" data-index="'+i+'" id="li_'+ctl.id+'"><a class="mdl-list__item-secondary-action delctl" href="#"><i class="material-icons">delete</i></a>&nbsp;&nbsp;<span class="clickme editbehavior">me.'+name+' = function('+params+');</span></li>';
    }
    newhtml += '</ul>';
  }
  el.html(newhtml);
  el.find('.delctl').click(function(e){
    var i = $(this).closest('.mdl-list__item').data("index");
    me.list.splice(i,1);
    me.parent.dirty();
    rebuildBehaviors();
  });
  el.find('.editbehavior').click(function(e){
    var i = $(this).closest('.mdl-list__item').data("index");
    var d = me.list[i];
    var el = $('#'+me.parent.UUID).find('.editbehaviorhere');
    installControl(el[0], 'metabot', 'editbehavior', function(api){
      api.parent = me;
    }, d);
  });
};
me.rebuildBehaviors = rebuildBehaviors;

$(ME).find('.newbehaviorbutton').click(function(e){
  var id1 = guid();
  var id2 = guid();
  var chooselang = $('<div style="color:#83bc00;font-size:12px">Language:</div><label class="mdl-radio mdl-js-radio mdl-js-ripple-effect" for="'+id1+'"><input type="radio" id="'+id1+'" class="mdl-radio__button" name="options" value="1" checked><span class="mdl-radio__label">Javascript</span></label><br><label class="mdl-radio mdl-js-radio mdl-js-ripple-effect" for="'+id2+'"><input type="radio" id="'+id2+'" class="mdl-radio__button" name="options" value="2"><span class="mdl-radio__label">Flow</span></label>');
  
  var d = {};
  d.title = "New Behavior";
  d.text = "Behavior Name";
  d.cb = function(val){
    var lang = chooselang.find('#'+id2).prop('checked') ? 'flow' : 'js';
    var d = {};
    d.name = val;
    d.lang = lang;
    d.params = [];
    d.body = "var me = this;\nvar ME = $('#'+me.UUID)[0];\n\n";
    d.id = guid();
    me.list.push(d);
    me.parent.dirty();
    rebuildBehaviors();
  };
  
  var i = 1;
  while(getByProperty(me.list, "name", "behavior"+i) != null) i++;
  d.value = "behavior"+i;
  installControl($(ME).find('.popmeup')[0], 'metabot', 'promptdialog', function(api){
    $(ME).find('form').append(chooselang);
    $(ME).find('.subtext').css('display', 'none');
    $(ME).find('.thin2').css('height', '140px');
    componentHandler.upgradeAllRegistered();
  }, d);
});