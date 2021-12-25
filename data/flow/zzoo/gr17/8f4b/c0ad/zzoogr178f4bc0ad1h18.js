var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  if (!ME.DATA.name) ME.DATA.name = "UNTITLED";
  $(ME).find(".node_name").val(ME.DATA.name);
  componentHandler.upgradeAllRegistered();
  
  if (!ME.DATA.type) ME.DATA.type = "string";
  var d = { 
    "list": [ "int", "decimal", "boolean", "string", "object", "array" ],
    "value": ME.DATA.type,
    "label": "Type",
    "cb": function(val){ ME.DATA.type = val; me.parent.dirty(); }
  };
  var el = $(ME).find(".node_type_div");
  installControl(el[0], "metabot", "select", function(api){}, d);
  
  if (!ME.DATA.mode) ME.DATA.type = "regular";
  var d = { 
    "list": [ "regular", "list", "loop" ],
    "value": ME.DATA.mode,
    "label": "Mode",
    "cb": function(val){ 
      ME.DATA.mode = val; 
      
      if (val == 'loop')
      {
        var putbar = me.parent.parent;
        var b = putbar.direction == 'src';
        putbar = b ? putbar.parent.inputbar.api : putbar.parent.outputbar.api;
        var d = {
          "x": 0,
          "type": me.parent.data.type,
          "mode": me.parent.data.mode,
          "name": putbar.nextNodeName()
        };
        putbar.addNode(d, new THREE.Vector3(me.parent.model.rig.pos_x,0,0), function(node){
          putbar.updateWidth();
          node.data.loop = me.parent;
          me.parent.data.loop = node;
        });
      }
      else if (me.parent.data.loop){
        me.parent.data.loop.delete();
        delete me.parent.data.loop;
      }
      me.parent.dirty(); 
    }
  };
  var el = $(ME).find(".node_mode_div");
  installControl(el[0], "metabot", "select", function(api){}, d);
  
  $(ME).find('.node_name').change(function(e){
    ME.DATA.name = this.value;
    me.parent.dirty();
  });
};
