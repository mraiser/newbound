var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  if (!ME.DATA.name) ME.DATA.name = "UNTITLED";
  $(ME).find(".operation_name").val(ME.DATA.name).keyup(function(x){
    me.parent.setLabel($(event.target).val());
  }).change(function(x){
    me.parent.setLabel($(event.target).val());
  });
  $(ME).find(".operation_cvalue").val(ME.DATA.name).keyup(function(x){
    me.parent.setLabel($(event.target).val());
    $(ME).find(".operation_name").val($(event.target).val());
  }).change(function(x){
    me.parent.setLabel($(event.target).val());
    $(ME).find(".operation_name").val($(event.target).val());
  });
  componentHandler.upgradeAllRegistered();
  
  if (!ME.DATA.type) ME.DATA.type = "local";
  var d = { 
    "list": [ "local", "function", "primitive", "constant", "command", "match", "persistent" ],
    "value": ME.DATA.type,
    "label": "Type",
    "cb": function(val){
      ME.DATA.type = val;
      me.parent.setShape(val);
      if (val == "primitive"){
        val = me.primselect.value();
        ME.DATA.name = val;
        me.parent.setLabel(val);
        $(ME).find(".operation_name").val(val);
        me.parent.setNodes(me.prims[val]);
      }
      else if (val == "constant"){
        me.parent.setNodes({"in":{}, "out":{"a":{}}});
        $(ME).find(".operation_cvalue").val($(ME).find(".operation_name").val());
      }
      else if (val == "match"){
        me.parent.setNodes({"out":{}, "in":{"a":{}}});
      }
      else if(val == "command"){
        selectCommand();
      }
      updateLayout();
    }
  };
  
  var el = $(ME).find(".operation_type_div");
  installControl(el[0], "metabot", "select", function(api){}, d);
  
  json("../botmanager/primitives", null, function(result){
    me.prims = result;
    var list = [];
    for (var name in me.prims) 
      if (typeof me.prims[name] != "string")
        list.push(name);
    var d = { 
      "list": list,
      "value": ME.DATA.name,
      "label": "Primitive",
      "cb": function(val){
        ME.DATA.name = val;
        me.parent.setLabel(val);
        $(ME).find(".operation_name").val(val);
        me.parent.setNodes(me.prims[val]);
      }
    };
  
    var el = $(ME).find(".operation_prim_list_div");
    installControl(el[0], "metabot", "select", function(api){ 
      me.primselect = api; 
    }, d);
  });
  
  if (!ME.DATA.ctype) ME.DATA.ctype = 'string';
  var d = { 
    "list": [ "int", "decimal", "boolean", "string", "object", "array", "me", "ME", "null" ],
    "value": ME.DATA.ctype,
    "label": "Constant Type",
    "cb": function(val){
      ME.DATA.ctype = val;
      var b = val == "null";
      if (b) {
        $(ME).find('.operation_name').val("null");
        $(ME).find(".operation_cvalue").val("null").closest("form").css("display","none");
        me.parent.setLabel("null");
      }
      else $(ME).find(".operation_cvalue").val("null").closest("form").css("display","block");
    }
  };
  var el = $(ME).find(".operation_ctype_list_div");
  installControl(el[0], "metabot", "select", function(api){}, d);

  var d = {
    "value": ME.DATA.cmd,
    "cb": function(val){
      if (ME.DATA.type == "command") selectCommand();
    },
    "ready": function(api) {
      me.cmdsel = api;
    }
  };
  var el = $(ME).find(".commandselectdiv");
  installControl(el[0], "metabot", "commandselect", function(api){}, d);

  updateLayout();
};

function selectCommand(){
  var cmdid = me.cmdsel.value();
  var cmdname = me.cmdsel.name();
  var cmdctl = me.cmdsel.ctlsel.value();
  var ctllib = me.cmdsel.ctlsel.lib;
  ME.DATA.cmd = ctllib+":"+cmdctl+":"+cmdid;
  me.parent.setLabel(cmdname);
  $(ME).find(".operation_name").val(cmdname);
  //var command = me.cmdsel.command();
  json('../botmanager/read', 'db='+ctllib+'&id='+cmdid, function(result){
    var type = result.data.type ? result.data.type : result.data.lang ? result.data.lang : "java";
    var code = result.data[type];
    json('../botmanager/read', 'db='+ctllib+'&id='+code, function(result){
      // FIXME - Does not match list of ctypes
      var nodes = {};
      nodes.in = {};
      nodes.out = {
        "result" : {
          "type": result.data.returntype ? result.data.returntype.toLowerCase() : "object"
        }
      };
      for (var i in result.data.params){
        var param = result.data.params[i];
        nodes.in[param.name] = {
          "type": param.type.toLowerCase()
        };
      }
      me.parent.setNodes(nodes);
    });
  });
}

function updateLayout(){
  if (ME.DATA.type == "constant") {
    ME.DATA.condition = null;
    $(ME).find(".conditionselectdiv").css("display", "none");
  }
  else $(ME).find(".conditionselectdiv").css("display", "block");
  
  $(ME).find(".operation_name").closest("form").css("display", ME.DATA.type == "local" || ME.DATA.type == "match" || ME.DATA.type == "function" || ME.DATA.type == "persistent" ? "block" : "none"); 
  $(ME).find(".operation_prim_list_div").css("display", ME.DATA.type == "primitive" ? "block" : "none"); 
  $(ME).find(".operation_ctype").css("display", ME.DATA.type == "constant" || ME.DATA.type == "match" ? "block" : "none");   
  $(ME).find(".commandselectdiv").css("display", ME.DATA.type == "command" ? "block" : "none");   
  $(ME).find(".isconcheckbox").css("display", ME.DATA.type == "match" ? "none" : "inline-block");   
  $(ME).find(".ifconditionisallowed").css("margin-left", ME.DATA.type == "match" ? "0px" : "25px");   
  $(ME).find(".showonconditional").css("display", ME.DATA.condition ? "block" : "none");
  try { 
    $(ME).find("#isconditional").prop("checked", typeof ME.DATA.condition == "object" && ME.DATA.condition != null).parent()[0].MaterialCheckbox.checkToggleState(); 
    if (ME.DATA.condition){
      $(ME).find("#ontrue").prop("checked", ME.DATA.condition.value).parent()[0].MaterialRadio.checkToggleState();
      $(ME).find("#onfalse").prop("checked", !ME.DATA.condition.value).parent()[0].MaterialRadio.checkToggleState();
      $(ME).find("#nextcase").prop("checked", ME.DATA.condition.rule == "next").parent()[0].MaterialRadio.checkToggleState();
      $(ME).find("#terminate").prop("checked", ME.DATA.condition.rule == "terminate").parent()[0].MaterialRadio.checkToggleState();
      $(ME).find("#finish").prop("checked", ME.DATA.condition.rule == "finish").parent()[0].MaterialRadio.checkToggleState();
      $(ME).find("#fail").prop("checked", ME.DATA.condition.rule == "fail").parent()[0].MaterialRadio.checkToggleState();
    }
  } catch (x) {};
};

$(ME).find("#isconditional").change(function(e){
  var b = $(this).prop("checked");
  $(ME).find('.showonconditional').css("display", b ? "block" : "none");
  ME.DATA.condition = b ? {
      "value": true,
      "rule": "next"
    } : null;
  me.parent.checkIcon();
  updateLayout();
});

$(ME).find("#ontrue").click(function(e){
  ME.DATA.condition.value = true;
  me.parent.checkIcon();
});

$(ME).find("#onfalse").click(function(e){
  ME.DATA.condition.value = false;
  me.parent.checkIcon();
});

$(ME).find("#nextcase").click(function(e){
  ME.DATA.condition.rule = "next";
  me.parent.checkIcon();
});

$(ME).find("#terminate").click(function(e){
  ME.DATA.condition.rule = "terminate";
  me.parent.checkIcon();
});

$(ME).find("#finish").click(function(e){
  ME.DATA.condition.rule = "finish";
  me.parent.checkIcon();
});

$(ME).find("#fail").click(function(e){
  ME.DATA.condition.rule = "fail";
  me.parent.checkIcon();
});