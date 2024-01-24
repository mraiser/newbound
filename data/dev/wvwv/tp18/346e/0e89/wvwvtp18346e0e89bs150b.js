var me = this; 
var ME = $('#'+me.UUID)[0];

var cmtheme = typeof CODEMIRRORTHEME != 'undefined' ? CODEMIRRORTHEME : 'abcdef';

me.ready = function(api){
  var lang = me.lang = ME.DATA.cmd.lang ? ME.DATA.cmd.lang : ME.DATA.cmd.type ? ME.DATA.cmd.type : 'java';
  var mode = lang == 'java' ? 'text/x-java' : lang == 'js' ? 'javascript' : lang;
  var cid = ME.DATA.cmd[lang] ? ME.DATA.cmd[lang] : ME.DATA.cmd.cmd
  
  $(ME).find('.ecmd-name').text(ME.DATA.name);
  $(ME).find('.editcommandiddisplay').text(ME.DATA.cmd.id);
  $(ME).find('.editcommand'+lang+'iddisplay').text(ME.DATA.cmd[lang]);
  
  json('../app/read', 'lib='+ME.DATA.lib+'&id='+cid, function(result){ 
    
    if (!result.data) result.data = {};
    
    me.cmddata = result.data;
    var code = lang == "rust" ? result.data["rs"] : result.data[lang];
    
    $(ME).find('#ecmd_groups').val(result.data.groups).change(me.dirty).keyup(me.dirty);
    $(ME).find('#ecmd_desc').val(result.data.desc).change(me.dirty).keyup(me.dirty);
    $(ME).find('#commandcode'+lang).val(code).change(me.dirty).keyup(me.dirty);

    var rt = result.data.returntype ? result.data.returntype : 'JSONObject';
    $(ME).find('.rtbutton').removeClass('rtbselected');
    $(ME).find('#rtb'+rt.toLowerCase()).addClass('rtbselected');
    $(ME).find('.returntypespan').text(rt);
    $(ME).find('.methodnamespan').text(ME.DATA.name);
    
    $(ME).find('.langbutton').removeClass('lbselected');
    $(ME).find('#lang_'+lang).addClass('lbselected');
    
    $(ME).find('.imports').css('display', lang != 'js' ? 'inline-block' : 'none');
    $(ME).find('.importform').css('display', 'none');
    $(ME).find('.import'+lang).css('display', 'block');
    if (result.data.import) {
      if (lang == 'java') $(ME).find('#ecmd_imports').val(result.data.import).change(me.dirty).keyup(me.dirty);
      else if (lang == 'python') $(ME).find('#ecmdpy_imports').val(result.data.import).change(me.dirty).keyup(me.dirty);
      else if (lang == 'rust') $(ME).find('#ecmdrust_imports').val(result.data.import).change(me.dirty).keyup(me.dirty);
    }

    $(ME).find('.rtbutton').click(function(){ 
      me.dirty();
      $('.rtbutton').removeClass('rtbselected');
      $(this).addClass('rtbselected').blur();
      me.cmddata.returntype = hackFix(this.id.substring(3));
    });

    $(ME).find('.langbutton').click(function(){ 
      me.dirty();
      $('.langbutton').removeClass('lbselected');
      $(this).addClass('lbselected').blur();
      
      var c = $(ME).find('#commandcode'+lang)[0];
      if (c.cm) c.cm.toTextArea();
      
      lang = me.lang = ME.DATA.cmd.lang = this.id.substring(5);
      conf.mode = mode = lang == 'java' ? 'text/x-java' : lang == 'js' ? 'javascript' : lang;
      
      $(ME).find('.imports').css('display', lang != 'js' && lang != 'flow' ? 'inline-block' : 'none');
      $(ME).find('.importform').css('display', 'none');
      $(ME).find('.import'+lang).css('display', 'block');
      $(ME).find('.cmdlable').css('display', 'none');
      $(ME).find('.cmdlable'+lang).css('display', 'inline-block');
      
      c = $(ME).find('#commandcode'+lang)[0];
      if (lang != 'flow') c.cm = CodeMirror.fromTextArea(c, conf);
      
      if (!ME.DATA.cmd[lang]){
        var code = lang == 'java' ? 'return null;' : lang == 'python' ? "return 'something'" : lang == 'rust' ? "DataObject::new()" : lang == 'js' ? "return 'something';" : "{\"cons\":[], \"cmds\":[], \"input\":{}, \"output\":{}}";
        if (lang != 'flow'){
          c.cm.setValue(code);
          me.cmddata[lang] = code;
        }
        else {
          installControl("#commandcodeflow", "flow", "editor", function(api){
              me.floweditor = api;
              api.parent = me;
          }, JSON.parse(code));
        }
        json('../app/unique_session_id', null, function(result){
          ME.DATA.cmd[lang] = result.msg;
          $(ME).find('.editcommand'+lang+'iddisplay').text(ME.DATA.cmd[lang]);
        });
      }
      else {
        $(ME).find('.editcommand'+lang+'iddisplay').text(ME.DATA.cmd[lang]);
        json('../app/read', 'lib='+encodeURIComponent(ME.DATA.lib)+'&id='+encodeURIComponent(ME.DATA.cmd[lang]), function(result){
          me.cmddata = result.data
          if (lang != 'flow'){
            c.cm.setValue(me.cmddata[lang]);
          }
          else {
            installControl("#commandcodeflow", "flow", "editor", function(api){
              me.floweditor = api;
              api.parent = me;
            }, me.cmddata[lang]);
          }
          $(ME).find('.editcommand'+lang+'iddisplay').text(ME.DATA.cmd[lang]);
        });
      }
    });
    
    $(ME).find('.cmdlable').css('display', 'none');
    $(ME).find('.cmdlable'+lang).css('display', 'inline-block');
    
    buildParams();
    
    var c = $(ME).find('#commandcode'+lang)[0];
    var conf = {
      mode : mode,
      theme: cmtheme,
      lineWrapping: true,
      autofocus : false,
      viewportMargin: Infinity,
      onChange: function (cm) { alert(99); }
    };
    if (lang != 'flow') {
      c.cm = CodeMirror.fromTextArea(c, conf);
    }
    else {
      installControl("#commandcodeflow", "flow", "editor", function(api){
        me.floweditor = api;
        api.parent = me;
      }, me.cmddata[lang]);
    }
    
    $(ME).find('textarea').change(me.dirty).keyup(me.dirty);
    
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
        "type": $(ME).find('#cmd_edit_java_newparamtype').val()
      };

      if (p.name.length<1) alert("Please give the new parameter a valid name");
      else if (getByProperty(me.cmddata.params, 'name', p.name)) alert('There is already a parameter with that name.');
      else {
        me.cmddata.params.push(p);
        $(ME).find('.addmethodparam').css('display', 'inline-block');
        $(ME).find('.newparam').css('display', 'none');
        buildParams();
        me.dirty();
      }
    });
  });
};

$(ME).find('.cancelcommandbutton').click(function(){ 
  $('.api-main').css('display', 'block');
  $('.api-editcommand').css('display', 'none').empty();
});

function buildParams(){
  if (!me.cmddata.params) me.cmddata.params = [];
  var list = me.cmddata.params;
  var params = '';
  var b = false;
  for (var i in list){
    var rdpi = list[i];
    if (b) params += ', ';
    params += '<img class="roundbutton-small mpdelete" data-index="'+i+'" src="../app/asset/app/delete_icon-white.png">';
    params += rdpi.type+' '+rdpi.name;
  }
  $(ME).find('.methodparams').html(params);
  $(ME).find('.mpdelete').click(function(){
    var i = $(this).data('index');
    me.cmddata.params.splice(i,1);
    buildParams();
    me.dirty();
  });
}

$(ME).find('#deletecommandbutton').click(function(e){ // FIXME - Does not delete code controls or attachments
  var data = {
    title:'Delete Command',
    text:'Are you sure you want to delete this command? This cannot be undone.',
    "clientX":e.clientX,
    "clientY":e.clientY,
    cancel:'cancel',
    ok:'delete',
    cb: function(){
      json('../app/delete', 'lib='+ME.DATA.lib+'&id='+encodeURIComponent(ME.DATA.cmd.id), function(result){
        if (result.status != 'ok') {
          alert(result.msg);
        }
        else {
          var c = $(ME).find('#commandcode'+me.lang)[0];
          var data = getByProperty(ME.DATA.data.cmd, 'id', c.uuid);
          var i = ME.DATA.data.cmd.indexOf(data);
          ME.DATA.data.cmd.splice(i, 1);
          $($('.savebutton')[0]).click(); // FIXME - Whoah that is not safe
          $('.api-main').css('display', 'block');
          $('.api-editcommand').css('display', 'none').empty();
          ME.DATA.ctlapi.buildCommandList();
        }
      });
    }
  };
  document.body.api.ui.confirm(data);
});

$(ME).find('#savecommandbutton').click(function(){ 
  var lang = me.lang;
  var readers = $('#ecmd_groups').val().trim();
  if (readers != '') readers = '&readers='+JSON.stringify(readers.split(','));

  var cmd = {
    "name": ME.DATA.cmd.name,
    "type": lang,
    "id": ME.DATA.cmd.id
  };
  cmd[lang] = ME.DATA.cmd[lang];
  console.log("WRITE "+ME.DATA.lib+" / "+ME.DATA.cmd.id+" / "+readers+" / "+JSON.stringify(cmd));
  json('../app/write', 'lib='+encodeURIComponent(ME.DATA.lib)+'&id='+encodeURIComponent(ME.DATA.cmd.id)+readers+'&data='+encodeURIComponent(JSON.stringify(cmd)), function(result){
    var c = $('#commandcode'+lang)[0];
    var data = lang == 'flow' ? me.floweditor.getData() : c.cm.getValue(); //$('#cmd_edit_java').val();
    var returntype = hackFix($(ME).find('.rtbselected')[0].id.substring(3));
    var imports = lang == "rust" ? $('#ecmdrust_imports').val() : lang == 'js' || lang == 'flow' ? '' : lang == 'java' ? $('#ecmd_imports').val() : $('#ecmdpy_imports').val();
    var desc = $('#ecmd_desc').val().trim();
    var params = me.cmddata.params;
    var cmddata = {};
    var groups = $('#ecmd_groups').val().trim();
    cmddata.type = lang;
    cmddata[lang == "rust" ? "rs" : lang] = data;
    cmddata.params = params;
    cmddata.returntype=returntype;
    cmddata.import = imports;
    cmddata.desc = desc;
    cmddata.attachmentkeynames = [ lang == "rust" ? "rs" : lang ];
    if (groups != '') cmddata.groups = groups;

    cmddata.lib = ME.DATA.data.db;;
    cmddata.ctl = ME.DATA.data.name;
    cmddata.cmd = ME.DATA.name;

    console.log("WRITE "+ME.DATA.lib+" / "+ME.DATA.cmd[lang]+" / "+readers+" / "+JSON.stringify(cmddata));
    json('../app/write', 'lib='+encodeURIComponent(ME.DATA.lib)+'&id='+encodeURIComponent(ME.DATA.cmd[lang])+readers+'&data='+encodeURIComponent(JSON.stringify(cmddata)), function(result){
      if (result.status !='ok') alert(result.msg);
      me.clean();
      console.log("COMPILE "+ME.DATA.lib+" / "+ME.DATA.cmd.id+" / "+JSON.stringify(ME.DATA.cmd[lang])+" / "+JSON.stringify(data));
      $(ME).find('.javaerror').html('');
      json('../dev/compile', 'lib='+ME.DATA.lib+'&ctl='+encodeURIComponent(ME.DATA.ctlapi.data.name)+'&cmd='+encodeURIComponent(ME.DATA.name), function(result){
        if (result.status != 'ok')  $(ME).find('.javaerror').html('<pre>'+result.msg+'</pre>');
        else {
          document.body.api.ui.snackbar({ message: "Your command has been saved." });
        }
      });
    });
  });
});

var hackfixnames1 = [ 'jsonobject', 'jsonarray', 'string', 'integer', 'float', 'boolean', 'any', 'file', 'inputstream', 'flat' ];
var hackfixnames2 = [ 'JSONObject', 'JSONArray', 'String', 'Integer', 'Float', 'Boolean', 'Any', 'File', 'InputStream', 'FLAT' ];

function hackFix(name){
  return hackfixnames2[hackfixnames1.indexOf(name)];
}

me.dirty = function(){
  $('#savecommandbutton').removeClass('accentbutton').addClass('coloredbutton');
};

me.clean = function(){
  $('#savecommandbutton').removeClass('coloredbutton').addClass('accentbutton');
};