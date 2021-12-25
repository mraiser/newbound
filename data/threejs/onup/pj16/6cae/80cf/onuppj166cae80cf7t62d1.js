var me = this;
var ME = $('#'+me.UUID)[0];

me.poses = ME.DATA.poses = ME.DATA.poses ? ME.DATA.poses : [];
me.animation = ME.DATA.animation = ME.DATA.animation ? ME.DATA.animation : {};
me.millis = ME.DATA.animation.millis = ME.DATA.animation.millis ? ME.DATA.animation.millis : 1000;
me.pose = ME.DATA.animation.pose;

me.ready = function(){
  var id = guid();
  var newhtml = '<form action="#"><div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label"><input class="mdl-textfield__input" type="text" pattern="-?[0-9]*(\.[0-9]+)?" id="'+id+'" value="'+me.millis+'"><label class="mdl-textfield__label" for="'+id+'">Milliseconds</label><span class="mdl-textfield__error">Input is not a number!</span></div></form>';
  $(ME).find('.apmillis').html(newhtml);
  componentHandler.upgradeAllRegistered();
  
  el = $(ME).find('.apselect');
  var data = {
    label: 'Pose',
    list: me.poses,
    value:me.pose
  }
  installControl(el[0], 'metabot', 'select', function(api){}, data);
};
