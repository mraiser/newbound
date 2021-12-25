var me = this;
var ME = $('#'+me.UUID)[0];

function addFunction(obj, name, code){
  var args = [];
  for (j in code.params) args.push(code.params[j].name);
  obj[name] = function(){
    var params = {};
    for (j in args) params[args[j]] = arguments[j];
    return execute(obj, deepCopy(code.flow), params);
  }
}
me.addFunction = addFunction;

function execute(obj, code, args){
  var i = 0;
  var done = false;
  var out = {};
  
  code.FINISHFLAG = false;
  var currentcase = code;
  while (true){
    var cmds = currentcase.cmds;
    var cons = currentcase.cons;
    
    var n = cons.length;
    var n2 = cmds.length;
    
    for (i=0;i<n2;i++){
      var cmd = cmds[i];
      if (!cmd.done){
        var input = cmd.in;
        if (Object.keys(input).length == 0) evaluate(obj, cmd);
        else{
          var b = true;
          for (var key in input){
            // input[key].done = false; // FIXME - Java interpreter seems to require this
            var con = lookupConnection(currentcase, key, "in");
            if (con == null) input[key].done = true;
            else b = false;
          }
          if (b) evaluate(obj, cmd);
        }
      }
    }
    
    while (!done){
      var c = true;
      
      for (i = 0; i < n; i++) {
        var con = cons[i];
        if (!con.done){
          c = false;
          var ja = con.src;
          var src = ja[0];
          var srcname = ja[1];
          ja = con.dest;
          var dest = ja[0];
          var destname = ja[1];
          
          var b = false;
          var val;
          if (src == -1){
            val = args[srcname];
            b = true;
          }
          else {
            var cmd = cmds[src];
            if (cmd.done){
              var vals = cmd.out;
              var val = vals[srcname];
              b = true;
            }
          }
          
          if (b) {
            con.done = true;
            if (dest == -2){
              out[destname] = val;
            }
            else{
              var cmd = cmds[dest];
              if (cmd.type == 'undefined'){ // FIXME - is this used?
                cmd.done = true;
              }
              else{
                var ins = cmd.in;
                var v = ins[destname];
                v.val = val;
                v.done = true;
                
                for (var key in ins){
                  if (!b) break;
                  var input = ins[key];
                  b = input.done;
                }
                
                if (b) evaluate(obj, cmd);
              }
            }
          }
        }
      }
        
      if (c) 
        done = true;
    }
    break;
  }
  // FIXME - catch next case exception and terminate case exception here
  
  return out;
}
me.execute = execute;

function lookupConnection(currentcase, name, which){
  var cons = currentcase.cons;
  for (var i in cons){
    var con = cons[i];
    var bar = con[which == 'in' ? 'dest' : 'src'];
    if (bar[1] == name) return con;
  }
  return null;
}

function evaluate(obj, cmd){
  var in1 = {};
  var in2 = cmd['in'];
  var list_in = [];
  for (var name in in2){
    var in3 = in2[name];
    in1[name] = in3.val;
    if (in3.mode == 'list') list_in.push(name);
  }
  
  var out2 = cmd.out;
  var list_out = [];
  var loop_out = [];
  for (var name in out2){
    var out3 = out2[name];
    if (out3.mode){
      var mode = out3.mode;
      if (mode == 'list') list_out.push(name);
      else if (mode == 'loop') loop_out.push(name);
    }
  }
  
  var n = list_in.length;
  if (n == 0 && loop_out.length == 0) evaluateOperation(obj, cmd, in1);
  else{
    var out3 = {};
    for (var i=0; i<list_out.length; i++) out3[list_out[i]] = [];
    var count = 0;
    if (n>0){
      count = in1[list_in[0]].length;
      for (var i = 0; i < n; i++) count = Math.min(count, in1[list_in[0]].length);
    }
    
    var i = 0;
    while (true){
      var in3 = {};
      for (var k in in1){
        if (list_in.indexOf(k) == -1) in3[k] = in1[k];
        else{
          var ja = in1[k];
          in3[k] = ja[i];
        }
      }
      
      evaluateOperation(obj, cmd, in3);
      
      var out = cmd.out;
      for (var k in out2){ // FIXME - aren't out & out2 the same thing?
        var val = out[k];
        if (list_out.indexOf(k) != -1) out3[k].push(val);
        else{
          out3[k] = val;
          if (loop_out.indexOf(k) != -1){
            var newk = out2[k]["loop"];
            in1[newk] = val;
          }
        }
      }
      if (cmd.FINISHED) break;
      if (n>0){
        i++;
        if (i == count) break;
      }
    }
  
    cmd.out = out3;
  }
}

function evaluateOperation(obj, cmd, in1){
  var out = {};
  var type = cmd.type;
  var b = false;
  try{
    if (type == 'primitive') out = handlePrimitive(cmd, in1);
    else if (type == 'function'){
      var keys = Object.keys(in1);
      var o = in1[keys[0]]
      var name = cmd.name;
      var args = [];
      for (var i=1;i<keys.length;i++) args.push(in1[keys[i]]);
      o = o[name].apply(o, args);
      keys = Object.keys(cmd.out);
      if (keys.length>0) out[keys[0]] = o;
    }
    else if (type == 'local'){
      var code = cmd.localdata;
      code = deepCopy(code);
      out = execute(obj, code, in1);
      cmd.FINISHED = code.FINISHFLAG;
    }
    else if (type == 'constant'){
      out = cmd.out;
      for (var key in out){
        var val = cmd.name;
        var ctype = cmd.ctype;
        if (ctype == 'me') out[key] = obj;
        else if (ctype == 'ME') out[key] = $('#'+obj.UUID)[0];
        else out[key] = forceType(ctype, val);
      }
    }
    else if (type == 'match'){
      var a = in1[Object.keys(in1)[0]];
      var ctype = cmd.ctype;
      var val1 = forceType(ctype, a);
      var val2 = forceType(ctype, cmd.name);
      b = val1 === val2;
      out = {};
    }
    else if (type == 'command'){
      throw new Error("Commands not supported");
    }
    else out = {};
    
    if (type != 'match') b = true;
  }
  catch(x) { // FIXME - should this only catch FailException like java version?
    cmd.err = x;
    b = false;
    out = {};
    debugger;
  }
  finally {
    if (type != 'constant' && cmd.condition){
      var condition = cmd.condition;
      evaluateConditional(condition, b);
    }
    else if (!b) throw cmd.err; // Compensate for catching all
    
    cmd.out = out;
    cmd.done = true;
  }
}

function deepCopy(o){
  if (Array.isArray(o)){
    var no = [];
    for (var i in o) no.push(deepCopy(o[i]));
    return no;
  }
  else if (typeof o == 'object'){
    var no = {};
    for (var i in o) no[i] = deepCopy(o[i]);
    return no;
  }
  return o;
}

function forceType(ctype, val){
  if (typeof val == 'string'){
    if (ctype == 'int') val = parseInt(val);
    else if (ctype == 'decimal') val = Number(val);
    else if (ctype == 'boolean') val = val === 'true';
    else if (ctype == 'object' || ctype == 'array') val = JSON.parse(val);
  }
  else if (ctype == 'string') val = ''+val;
  return val;
}

function handlePrimitive(cmd, in1){
  var inkeys = Object.keys(cmd.in);
  var outkeys = Object.keys(cmd.out);
  var out = {};
  
  if (cmd.name == "+") out[outkeys[0]] = in1[inkeys[0]] + in1[inkeys[1]];
  else
    throw new Error("Unknown primitive: "+cmd.name);
  
  return out;
}
