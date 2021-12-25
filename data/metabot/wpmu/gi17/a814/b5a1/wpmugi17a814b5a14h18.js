var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(api){
  componentHandler.upgradeAllRegistered();
  
  me.cmddata = ME.DATA;
  
  var el = $(ME).find('.behaviorname');
  el.val(ME.DATA.name);
  el.change(updateBehaviorName);
  el.keyup(updateBehaviorName);
  
  buildParams();
  
  if (ME.DATA.lang != 'flow'){
    var cmtheme = typeof CODEMIRRORTHEME != 'undefined' ? CODEMIRRORTHEME : 'abcdef';
    var c = $(ME).find('.behaviorcode')[0];
    $(c).val(ME.DATA.body);
    var conf = {
      mode : "javascript",
      theme: cmtheme,
      lineWrapping: true,
      autofocus : false,
      viewportMargin: Infinity
    };
    c.cm = CodeMirror.fromTextArea(c, conf);
    c.cm.on('change', function(x){
      ME.DATA.body = c.cm.getValue();
      me.parent.dirty();
    });
  }
  else{
    $(ME).find('.behaviorcode').css('display', 'none');

    var el = $(ME).find(".behaviorflow");
    el.height($(ME).closest('.navtab').height() - 100);
    el.width($(ME).parent().find('.matrixviewer').width() - 40);
    
    var d = ME.DATA.flow ? ME.DATA.flow : {"cons":[], "cmds":[], "input":{}, "output":{}};
    installControl(el[0], "flow", "editor", function(api){
      me.floweditor = api;
      api.parent = me;

      me.dirty = function(){
        me.parent.dirty();
        setTimeout(function(){ ME.DATA.flow = api.getData(); }, 500);
      }
    }, d);
  }
  
  $(ME).find('.addmethodparam').click(function(){
    $(this).css('display', 'none');
    $(ME).find('.newparam').css('display', 'inline-block');
  });

  $(ME).find('.dontaddmethodparam').click(function(){
    $(ME).find('.addmethodparam').css('display', 'inline-block');
    $(ME).find('.newparam').css('display', 'none');
  });
  
  $(ME).find('.newparamaddbutton').click(function(){
    var p = { 
      "name": $(ME).find('.newparamname').val().trim(),
      "type": "object"
    };

    if (p.name.length<1) alert("Please give the new parameter a valid name");
    else if (getByProperty(me.cmddata.params, 'name', p.name)) alert('There is already a parameter with that name.');
    else {
      me.cmddata.params.push(p);
      $(ME).find('.addmethodparam').css('display', 'inline-block');
      $(ME).find('.newparam').css('display', 'none');
      buildParams();
      me.parent.dirty();
      me.parent.rebuildBehaviors();
    }
  });
};

function updateBehaviorName(){
  ME.DATA.name = $(ME).find('.behaviorname').val();
  me.parent.dirty();
  me.parent.rebuildBehaviors();
}

function buildParams(){
  if (!me.cmddata.params) me.cmddata.params = [];
  var list = me.cmddata.params;
  var params = '';
  var b = false;
  for (var i in list){
    var rdpi = list[i];
    if (b) params += ', ';
    params += '<i class="mdc-list-item__graphic material-icons mpdelete" aria-hidden="true" data-index="'+i+'">delete</i>';
    params += rdpi.name;
  }
  $(ME).find('.methodparams').html(params);
  $(ME).find('.mpdelete').click(function(){
    var i = $(this).data('index');
    me.cmddata.params.splice(i,1);
    buildParams();
    me.parent.dirty();
    me.parent.rebuildBehaviors();
  });
}
