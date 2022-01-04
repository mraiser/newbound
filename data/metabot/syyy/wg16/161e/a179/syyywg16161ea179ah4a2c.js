var me = this;
var ME = $('#'+me.UUID)[0];

var cmtheme = typeof CODEMIRRORTHEME != 'undefined' ? CODEMIRRORTHEME : 'abcdef';

me.ready = function(){
  componentHandler.upgradeAllRegistered();
  $(ME).find('#ecmd-name').text(ME.DATA.name);

  var lang = ME.DATA.cmd.lang ? ME.DATA.cmd.lang : ME.DATA.cmd.type ? ME.DATA.cmd.type : 'java';
  var mode = lang == 'java' ? 'text/x-java' : lang == 'js' ? 'javascript' : lang;
  var cid = ME.DATA.cmd[lang] ? ME.DATA.cmd[lang] : ME.DATA.cmd.cmd

  json('../botmanager/read', 'db='+ME.DATA.db+'&id='+cid, function(result){ 
    me.cmddata = result.data;
    var code = result.data[lang];
    $(ME).find('.editcommandiddisplay').text(ME.DATA.cmd.id);
    $(ME).find('.editcommand'+lang+'iddisplay').text(ME.DATA.cmd[lang]);
    $(ME).find('#ecmd_groups').val(result.data.groups);
    $(ME).find('#ecmd_desc').val(result.data.desc);
    $(ME).find('#commandcode'+lang).val(result.data[lang]);

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
    $(ME).find('.cmdlable').css('display', 'none');
    $(ME).find('.cmdlable'+lang).css('display', 'inline-block');
    
    buildParams();
    
    if (result.data.import) {
      if (lang == 'java') $(ME).find('#ecmd_imports').val(result.data.import);
      else if (lang == 'python') $(ME).find('#ecmdpy_imports').val(result.data.import);
    }
    
    var c = $(ME).find('#commandcode'+lang)[0];
    var conf = {
      mode : mode,
      theme: cmtheme,
      lineWrapping: true,
      autofocus : false,
      viewportMargin: Infinity,
      onChange: function (cm) { $('#savecommandbutton').removeClass('bggray').addClass('bggreen'); }
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
        $('#savecommandbutton').removeClass('bggray').addClass('bggreen');
      }
    });
    
    $(ME).find('#savecommandbutton').click(function(){ 
      var readers = $('#ecmd_groups').val().trim();
      if (readers != '') readers = '&readers='+JSON.stringify(readers.split(','));
      
      var cmd = {
        "name": ME.DATA.cmd.name,
        "type": lang,
        "id": ME.DATA.cmd.id
      };
      cmd[lang] = ME.DATA.cmd[lang];
      console.log("WRITE "+ME.DATA.db+" / "+ME.DATA.cmd.id+" / "+readers+" / "+JSON.stringify(cmd));
      json('../botmanager/write', 'db='+encodeURIComponent(ME.DATA.db)+'&id='+encodeURIComponent(ME.DATA.cmd.id)+readers+'&data='+encodeURIComponent(JSON.stringify(cmd)), function(result){
      
      
      
      
      
      
        var c = $('#commandcode'+lang)[0];
        var data = lang == 'flow' ? me.floweditor.getData() : c.cm.getValue(); //$('#cmd_edit_java').val();
        var returntype = hackFix($(ME).find('.rtbselected')[0].id.substring(3));
        var imports = lang == 'js' || lang == 'flow' ? '' : lang == 'java' ? $('#ecmd_imports').val() : $('#ecmdpy_imports').val();
        var desc = $('#ecmd_desc').val().trim();
        var params = me.cmddata.params;
        var cmddata = {};
        var groups = $('#ecmd_groups').val().trim();
        cmddata.type = lang;
        cmddata[lang] = data;
        cmddata.params = params;
        cmddata.returntype=returntype;
        cmddata.import = imports;
        cmddata.desc = desc;
        cmddata.attachmentkeynames = [ lang ];
        if (groups != '') cmddata.groups = groups;

        console.log("WRITE "+ME.DATA.db+" / "+ME.DATA.cmd[lang]+" / "+readers+" / "+JSON.stringify(cmddata));
        json('../botmanager/write', 'db='+encodeURIComponent(ME.DATA.db)+'&id='+encodeURIComponent(ME.DATA.cmd[lang])+readers+'&data='+encodeURIComponent(JSON.stringify(cmddata)), function(result){
          if (result.status !='ok') alert(result.msg);
          $('#savecommandbutton').removeClass('bggreen').addClass('bggray'); 


          console.log("COMPILE "+ME.DATA.db+" / "+ME.DATA.cmd.id+" / "+JSON.stringify(ME.DATA.cmd[lang])+" / "+JSON.stringify(data));
          json('../botmanager/compile', 'db='+ME.DATA.db+'&id='+encodeURIComponent(ME.DATA.cmd.id)+readers+'&cmd='+ME.DATA.cmd[lang]+'&'+lang+'='+encodeURIComponent(data)+'&returntype='+encodeURIComponent(returntype)+'&import='+encodeURIComponent(imports)+'&params='+encodeURIComponent(JSON.stringify(params)), function(result){
            if (result.status != 'ok')  $(ME).find('.javaerror').html('<pre>'+result.msg+'</pre>');
            else {
  //            var x = data;
  //            data = me.cmddata;
  //            data.type = lang;
  //            data[lang] = x;
  //            data.returntype=returntype;
  //            data.import=imports;
  //            data.desc = desc;

  //            document.body.api.saveControl();

  //            console.log("WRITE "+ME.DATA.db+" / "+cmd[lang]+" / "+readers+" / "+JSON.stringify(data));
  //            json('../botmanager/write', 'db='+ME.DATA.db+'&data='+encodeURIComponent(JSON.stringify(data))+readers+'&id='+encodeURIComponent(cmd[lang]), function(result){
  //              if (result.status != 'ok') $(ME).find('.javaerror').html(result.msg);
  //              else {
                  json('../metabot/buildjsapi', 'lib='+ME.DATA.db+'&id='+ME.DATA.ctl, function(result){
                    $(ME).find('.javaerror').html('Your command has been saved.');
                    setTimeout('$(".javaerror").html("");', 3000);
                  });
  //              }
  //            });
            }
          });
        });
      });
    });
    
    $(ME).find('#cancelcommandbutton').click(function(){ 
      $('.api-main').css('display', 'block');
      $('.api-editcommand').css('display', 'none').empty();
    });
    
    $(ME).find('#deletecommandbutton').click(function(){ // FIXME - Does not delete code controls or attachments
      if (confirm('Are you sure you want to delete this command? This cannot be undone.')) {
        json('../botmanager/delete', 'db='+ME.DATA.db+'&id='+encodeURIComponent(ME.DATA.cmd.id), function(result){
          if (result.status != 'ok') {
            alert(result.msg);
          }
          else {
            var data = getByProperty(ME.DATA.data.cmd, 'id', c.uuid);
            var i = ME.DATA.data.cmd.indexOf(data);
            ME.DATA.data.cmd.splice(i, 1);
            $($('.savebutton')[0]).click();
            $('.api-main').css('display', 'block');
            $('.api-editcommand').css('display', 'none').empty();
            ME.DATA.ctlapi.buildCommandList();
          }
        });
      }
    });
    
    $(ME).find('input').change(inputchange);
    $(ME).find('input').keyup(inputchange);
    $(ME).find('.newparamname').unbind('change');
    $(ME).find('.newparamname').unbind('keyup');
    $(ME).find('textarea').change(inputchange);
    $(ME).find('textarea').keyup(inputchange);
    $(ME).find('.rtbutton').click(function(){ 
      $('#savecommandbutton').removeClass('bggray').addClass('bggreen'); 
      $('.rtbutton').removeClass('rtbselected');
      $(this).addClass('rtbselected').blur();
      inputchange({"target": this});
    });
    $(ME).find('.langbutton').click(function(){ 
      $('#savecommandbutton').removeClass('bggray').addClass('bggreen'); 
      $('.langbutton').removeClass('lbselected');
      $(this).addClass('lbselected').blur();
      
      var c = $(ME).find('#commandcode'+lang)[0];
      if (c.cm) c.cm.toTextArea();
      
      lang = ME.DATA.cmd.lang = this.id.substring(5);
      conf.mode = mode = lang == 'java' ? 'text/x-java' : lang == 'js' ? 'javascript' : lang;
      
      $(ME).find('.imports').css('display', lang != 'js' && lang != 'flow' ? 'inline-block' : 'none');
      $(ME).find('.importform').css('display', 'none');
      $(ME).find('.import'+lang).css('display', 'block');
      $(ME).find('.cmdlable').css('display', 'none');
      $(ME).find('.cmdlable'+lang).css('display', 'inline-block');
      
      c = $(ME).find('#commandcode'+lang)[0];
      if (lang != 'flow') c.cm = CodeMirror.fromTextArea(c, conf);
      
      if (!ME.DATA.cmd[lang]){
        var code = lang == 'java' ? 'return null;' : lang == 'python' ? "return 'something'" : lang == 'js' ? "return 'something';" : "{\"cons\":[], \"cmds\":[], \"input\":{}, \"output\":{}}";
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
        json('../peerbot/suggestaccesscode', null, function(result){
          ME.DATA.cmd[lang] = result.msg;
          $(ME).find('.editcommand'+lang+'iddisplay').text(ME.DATA.cmd[lang]);
        });
      }
      else {
        $(ME).find('.editcommand'+lang+'iddisplay').text(ME.DATA.cmd[lang]);
        json('../botmanager/read', 'db='+encodeURIComponent(ME.DATA.db)+'&id='+encodeURIComponent(ME.DATA.cmd[lang]), function(result){
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
    
    
  });
};

function inputchange(e){
  var id = e.target.id;
  var val = $(e.target).val();
  if (id == 'ecmd_groups') me.cmddata.groups = val;
  else if (id == 'ecmd_desc') me.cmddata.desc = val;
  else if (id == 'ecmd_imports') me.cmddata.import = val;
  else if (id.indexOf('rtb' == 0)) me.cmddata.returntype = hackFix(id.substring(3));
           
  $('#savecommandbutton').removeClass('bggray').addClass('bggreen');
}

var hackfixnames1 = [ 'jsonobject', 'string', 'file', 'inputstream', 'flat' ];
var hackfixnames2 = [ 'JSONObject', 'String', 'File', 'InputStream', 'FLAT' ];

function hackFix(name){
  return hackfixnames2[hackfixnames1.indexOf(name)];
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
    params += rdpi.type+' '+rdpi.name;
  }
  $(ME).find('.methodparams').html(params);
  $(ME).find('.mpdelete').click(function(){
    var i = $(this).data('index');
    me.cmddata.params.splice(i,1);
    buildParams();
    $('#savecommandbutton').removeClass('bggray').addClass('bggreen');
  });
}

me.dirty = function(){
  $('#savecommandbutton').removeClass('bggray').addClass('bggreen');
};


