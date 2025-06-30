var me = this;
var ME = $('#'+me.UUID)[0];
var cmtheme = 'default';
var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';
var lib = getQueryParameter('lib');
var id = getQueryParameter('id');
me.ready = function(api){
  var lang = me.lang = ME.DATA.cmd.lang ? ME.DATA.cmd.lang : ME.DATA.cmd.type ? ME.DATA.cmd.type : 'java';
  var mode = lang == 'java' ? 'text/x-java' : lang == 'js' ? 'javascript' : lang;
  var cid = ME.DATA.cmd[lang] ? ME.DATA.cmd[lang] : ME.DATA.cmd.cmd
  cmtheme = $('body').hasClass('dark') ? 'darcula' : 'default';
  
  $(ME).find('.ecmd-name').text(ME.DATA.name);
  $(ME).find('.editcommandiddisplay').text(ME.DATA.cmd.id);
  $(ME).find('.editcommand'+lang+'iddisplay').text(ME.DATA.cmd[lang]);
  
  json('../app/read', 'lib='+ME.DATA.lib+'&id='+cid, function(result){
    
    if (!result.data) result.data = {};
    
    me.cmddata = result.data;
    var code = lang == "rust" ? result.data["rs"] : result.data[lang];
    
    $(ME).find('#ecmd_groups').val(result.data.groups).change(me.dirty).keyup(me.dirty);
    $(ME).find('#ecmd_desc').val(result.data.desc).change(me.dirty).keyup(me.dirty);
    $(ME).find('#commandcode'+lang).val(code);
    var rt = result.data.returntype ? result.data.returntype : 'JSONObject';
    $(ME).find('.rt-buttons .regularbutton').removeClass('rtbselected');
    $(ME).find('#rtb'+rt.toLowerCase()).addClass('rtbselected');
    $(ME).find('.returntypespan').text(rt);
    $(ME).find('.methodnamespan').text(ME.DATA.name);
    
    $(ME).find('.langbutton').removeClass('lbselected');
    $(ME).find('#lang_'+lang).addClass('lbselected');
    
    $(ME).find('.imports').css('display', lang !== 'js' && lang !== 'flow' ? 'block' : 'none');
    $(ME).find('.importform').css('display', 'none');
    $(ME).find('.import'+lang).css('display', 'block');
    if (result.data.import) {
      if (lang == 'java') $(ME).find('#ecmd_imports').val(result.data.import).change(me.dirty).keyup(me.dirty);
      else if (lang == 'python') $(ME).find('#ecmdpy_imports').val(result.data.import).change(me.dirty).keyup(me.dirty);
      else if (lang == 'rust') $(ME).find('#ecmdrust_imports').val(result.data.import).change(me.dirty).keyup(me.dirty);
    }
    $(ME).find('.rt-buttons .regularbutton').click(function(){
      me.dirty();
      $('.rt-buttons .regularbutton').removeClass('rtbselected');
      $(this).addClass('rtbselected').blur();
      me.cmddata.returntype = hackFix(this.id.substring(3));
      $(ME).find('.returntypespan').text(me.cmddata.returntype);
    });
    $(ME).find('.lang-buttons .regularbutton').click(function(){
      me.dirty();
      $('.lang-buttons .regularbutton').removeClass('lbselected');
      $(this).addClass('lbselected').blur();
      
      var c = $(ME).find('#commandcode'+lang)[0];
      if (c.cm) c.cm.toTextArea();
      
      lang = me.lang = ME.DATA.cmd.lang = this.id.substring(5);
      conf.mode = mode = lang == 'java' ? 'text/x-java' : lang == 'js' ? 'javascript' : lang;
      
      $(ME).find('.imports').css('display', lang != 'js' && lang != 'flow' ? 'block' : 'none');
      $(ME).find('.importform').css('display', 'none');
      $(ME).find('.import'+lang).css('display', 'block');
      $(ME).find('.cmdlable').css('display', 'none');
      $(ME).find('.cmdlable'+lang).css('display', 'inline');
      
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
    $(ME).find('.cmdlable'+lang).css('display', 'inline');
    
    buildParams();
    
    var c = $(ME).find('#commandcode'+lang)[0];
    var conf = {
      mode : mode,
      theme: cmtheme,
      lineNumbers: true,
      lineWrapping: true,
      autofocus : false,
      viewportMargin: Infinity,
    };
    if (lang != 'flow') {
      c.cm = CodeMirror.fromTextArea(c, conf);
        c.cm.on('change', me.dirty);
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
      $(ME).find('.newparam').css('display', 'flex');
    });
    
    $(ME).find('.dontaddmethodparam').click(function(){
      $(ME).find('.addmethodparam').css('display', 'inline-flex');
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
        $(ME).find('.addmethodparam').css('display', 'inline-flex');
        $(ME).find('.newparam').css('display', 'none');
        buildParams();
        me.dirty();
      }
    });
  });
};
$(ME).find('.cancelcommandbutton').click(function(){
  $('.api-main').css('display', 'flex');
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
    b = true;
    params += rdpi.type+' '+rdpi.name;
  }
  $(ME).find('.methodparams').html(params);
  generateForm(list);
}
$(ME).find('#deletecommandbutton').click(function(e){
  var data = {
    title:'Delete Command',
    text:'Are you sure you want to delete this command? This cannot be undone.',
    "clientX":e.clientX,
    "clientY":e.clientY,
    cancel:'Cancel',
    ok:'Delete',
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
          me.DATA.ctlapi.saveControl();
          $('.api-main').css('display', 'flex');
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
  
  var errorDiv = $(ME).find('.javaerror');
  errorDiv.removeClass('collapsed').html('<i>Saving...</i>').css('display','block');
  
  cmd[lang] = ME.DATA.cmd[lang];
  json('../app/write', 'lib='+encodeURIComponent(ME.DATA.lib)+'&id='+encodeURIComponent(ME.DATA.cmd.id)+readers+'&data='+encodeURIComponent(JSON.stringify(cmd)), function(result){
    var c = $('#commandcode'+lang)[0];
    var data = lang == 'flow' ? me.floweditor.getData() : c.cm.getValue();
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
    json('../app/write', 'lib='+encodeURIComponent(ME.DATA.lib)+'&id='+encodeURIComponent(ME.DATA.cmd[lang])+readers+'&data='+encodeURIComponent(JSON.stringify(cmddata)), function(result){
      if (result.status !='ok') alert(result.msg);
      me.clean();
      json('../dev/compile', 'lib='+ME.DATA.lib+'&ctl='+encodeURIComponent(ME.DATA.ctlapi.data.name)+'&cmd='+encodeURIComponent(ME.DATA.name), function(result){
        if (result.status != 'ok') {
          setJavaError(result.msg);
        } else {
          setJavaError(null);
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
  $('#savecommandbutton').removeClass('regularbutton').addClass('coloredbutton');
};
me.clean = function(){
  $('#savecommandbutton').removeClass('coloredbutton').addClass('regularbutton');
};

function setJavaError(message) {
    var errorDiv = $(ME).find('.javaerror');
    if (!message || message.trim() === '') {
        errorDiv.html('').css('display', 'none');
        return;
    }

    var lines = message.split('\n');
    var isMultiLine = lines.length > 1;

    var buttonHtml = isMultiLine ? '<button class="javaerror-toggle">Expand</button>' : '';
    var contentHtml = `<div class="javaerror-content"><pre>${message}</pre></div>`;
    
    errorDiv.html(buttonHtml + contentHtml).css('display', 'block');

    if (isMultiLine) {
        errorDiv.addClass('collapsed');
        var toggleBtn = errorDiv.find('.javaerror-toggle');

        toggleBtn.off('click').on('click', function() {
            if (errorDiv.hasClass('collapsed')) {
                errorDiv.removeClass('collapsed');
                $(this).text('Collapse');
            } else {
                errorDiv.addClass('collapsed');
                $(this).text('Expand');
            }
        });
    } else {
        errorDiv.removeClass('collapsed');
    }
}

function generateForm(params) {
  const form = document.getElementById("parameterForm");
  form.innerHTML = '';
  params.forEach((param, index) => {
    const paramId = `param-desc-${index}`;
    const formGroup = document.createElement("div");
    formGroup.className = "param-item";
    
    const labelText = `${param.name} (${param.type})`;
    const input = document.createElement("input");
    input.type = "text";
    input.value = param.desc || '';
    input.className = "textinput";
    input.placeholder = `Description for ${param.name}`;
    input.id = paramId;
    $(input).data("param", param).change(function(){
      var param = $(this).data('param');
      param.desc = $(this).val();
      me.dirty();
    });
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "regularbutton delete-param-button";
    deleteBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>`;
    $(deleteBtn).data("index", index).click(function(){
      var i = $(this).data('index');
      me.cmddata.params.splice(i,1);
      buildParams();
      me.dirty();
    });
    const label = document.createElement("label");
    label.innerText = labelText;
    label.setAttribute("for", paramId);
    label.className = "textinputlabel";
    
    form.appendChild(label);
    formGroup.appendChild(input);
    formGroup.appendChild(deleteBtn);
    form.appendChild(formGroup);
  });
}
function getCommandData() {
  const lang = me.lang;
  let code = "";
  let imports = "";
  let returntype = me.cmddata.returntype;
  const params = me.cmddata.params || [];
  // Get code based on the selected language
  if (lang === "java") {
    code = $("#commandcodejava").val();
  } else if (lang === "python") {
    code = $("#commandcodepython").val();
  } else if (lang === "rust") {
    code = $("#commandcoderust").val();
  } else if (lang === "js") {
    code = $("#commandcodejs").val();
  } else if (lang === "flow") {
    code = me.floweditor ? me.floweditor.getData() : "";
  }
  // Get imports based on the selected language
  if (lang === "java") {
    imports = $("#ecmd_imports").val();
  } else if (lang === "python") {
    imports = $("#ecmdpy_imports").val();
  } else if (lang === "rust") {
    imports = $("#ecmdrust_imports").val();
  }
  return { code, imports, returntype, lang, params };
}
me.getCommandData = getCommandData;
