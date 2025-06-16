var me = this; 
var ME = $('#'+me.UUID)[0];

var cmtheme = typeof CODEMIRRORTHEME != 'undefined' ? CODEMIRRORTHEME : 'abcdef';

var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';

var lib = getQueryParameter('lib');
var id = getQueryParameter('id');

me.ready = function(api){
}

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  ui.initNavbar(ME);
  
  $(ME).find('.ctl-lib').text(lib);
  
  lookupID(lib, id, function(result){
    id = result;
    json('../app/read', 'lib='+lib+'&id='+id, function(result){
      var data = me.data = result.data
      $(ME).find('.ctl-name').text(data.name);
      
      $(ME).find('.html-textarea').val(result.data.html);
      $(ME).find('.css-textarea').val(result.data.css);
      $(ME).find('.js-textarea').val(result.data.js);
      $(ME).find('#ov_groups').val(result.data.groups);
      $(ME).find('#ov_desc').val(result.data.desc);
      
      me.CTLDATA = result.data;
      
      buildData();
      
      var conf = {
        mode : "htmlmixed",
        theme: cmtheme,
        lineWrapping: true,
        autofocus : false,
        viewportMargin: Infinity,
        onChange: function (cm) { $('.savebutton').removeClass('mdl-button--accent').addClass('mdl-button--colored'); }
      };
      var c = $(ME).find('.html-textarea')[0];
      c.cm = CodeMirror.fromTextArea(c, conf);
      c.cm.on('change', function (cm) { me.dirty(); testData(); });

      c = $(ME).find('.css-textarea')[0];
      conf.mode='css';
      c.cm = CodeMirror.fromTextArea(c, conf);
      c.cm.on('change', function (cm) { me.dirty(); testData(); });

      c = $(ME).find('.js-textarea')[0];
      conf.mode='javascript';
      c.cm = CodeMirror.fromTextArea(c, conf);
      c.cm.on('change', function (cm) { me.dirty(); testData(); });

      var w = $(ME).width();
      var num = 0;
      if (result.data.html) { num++; $(ME).find('.editor-html').addClass('hasstuff'); }
      if (result.data.css) { num++; $(ME).find('.editor-css').addClass('hasstuff'); }
      if (result.data.js) { num++; $(ME).find('.editor-js').addClass('hasstuff'); }
      if (result.data.data && result.data.data.length>0) { num++; $(ME).find('.editor-data').addClass('hasstuff'); }

      if (num>0) {
        $('.editor').parent().width('20');
        $('.hasstuff').parent().width(w/num);
      }
      
      $(ME).find('.zoomer-pmin').click();
      
      me.buildCommandList();
      me.buildTimerList();
      me.buildEventList();
      me.buildPublish();
      me.build3D();
    });
  });
  
  $(ME).find('.backbutton').click(function(){ window.location.href='../dev/index.html?lib='+lib; });
};

me.build3D = function(){
  var el = $(ME).find('.three-main');
  installControl(el[0], 'dev', 'edit3d', function(api){}, me.data);
};

function validateName(s){
  var i = s.length;
  if (i == 0) return false;
  while (i-->0) if (validchars.indexOf(s.charAt(i)) == -1) return false;
  return true;
}

$(ME).find('.addtimerbutton').click(function(e){
  var d = {
    "title": "New Timer",
    "text": "Name",
    "subtext": "Lowercase letters, numbers and underscores only",
    "ok":"add",
    "cancel":"cancel",
    "clientX":e.clientX,
    "clientY":e.clientY,
    "validate":function(name) {
      if (validateName(name)) {
        if (getByProperty(me.CTLDATA.timer, 'name', name) != null) {
          document.body.api.ui.snackbar({"message": "There is already a timer with that name"});
          return false;
        }
        else return true;
      }
      else {
        document.body.api.ui.snackbar({"message": "Invalid characters"});
        return false;
      }
    },
    "cb":function(name){
      var data = {};
      json('../app/write', 'lib='+lib+'&data='+encodeURIComponent(JSON.stringify(data)), function(result){
        if (result.status != 'ok') alert(result.msg);
        else{
          data.name = name;
          data.id = result.id;
          if (!me.CTLDATA.timer) me.CTLDATA.timer = [];
          me.CTLDATA.timer.push(data);
          saveControl();
          me.buildTimerList();
        }
      });
    }
  };
  document.body.api.ui.prompt(d);      
});

$(ME).find('.addeventbutton').click(function(e){
  var d = {
    "title": "New Event",
    "text": "Name",
    "subtext": "Lowercase letters, numbers and underscores only",
    "ok":"add",
    "cancel":"cancel",
    "clientX":e.clientX,
    "clientY":e.clientY,
    "validate":function(name) {
      if (validateName(name)) {
        if (getByProperty(me.CTLDATA.event, 'name', name) != null) {
          document.body.api.ui.snackbar({"message": "There is already an event with that name"});
          return false;
        }
        else return true;
      }
      else {
        document.body.api.ui.snackbar({"message": "Invalid characters"});
        return false;
      }
    },
    "cb":function(name){
      var data = {};
      json('../app/write', 'lib='+lib+'&data='+encodeURIComponent(JSON.stringify(data)), function(result){
        if (result.status != 'ok') alert(result.msg);
        else{
          data.name = name;
          data.id = result.id;
          if (!me.CTLDATA.event) me.CTLDATA.event = [];
          me.CTLDATA.event.push(data);
          saveControl();
          me.buildEventList();
        }
      });
    }
  };
  document.body.api.ui.prompt(d);      
});

$(ME).find('.addcmdbutton').click(function(e){
  var d = {
    "title": "New Command",
    "text": "Name",
    "subtext": "Lowercase letters, numbers and underscores only",
    "ok":"add",
    "cancel":"cancel",
    "clientX":e.clientX,
    "clientY":e.clientY,
    "validate":function(name) {
      if (validateName(name)) {
        if (getByProperty(me.CTLDATA.cmd, 'name', name) != null) {
          document.body.api.ui.snackbar({"message": "There is already a command with that name"});
          return false;
        }
        else return true;
      }
      else {
        document.body.api.ui.snackbar({"message": "Invalid characters"});
        return false;
      }
    },
    "cb":function(name){
      var data = { java: 'return null;' };
      json('../app/write', 'lib='+lib+'&data='+encodeURIComponent(JSON.stringify(data)), function(result){
        if (result.status != 'ok') alert(result.msg);
        else {
          data.name = name;
          data.java = result.id;
          json('../app/write', 'lib='+lib+'&data='+encodeURIComponent(JSON.stringify(data)), function(result){
            if (result.status != 'ok') error(result.msg);
            else{
              data.id = result.id;
              if (!me.CTLDATA.cmd) me.CTLDATA.cmd = [];
              me.CTLDATA.cmd.push(data);
              saveControl();
              me.buildCommandList();
            }
          });
        }
      });
    }
  };
  document.body.api.ui.prompt(d);
});

me.buildTimerList = function(){
  if (me.CTLDATA.timer) me.CTLDATA.timer.sort((a, b) => (a.name > b.name) ? 1 : -1);
  var newhtml = '';
  for (var i in me.CTLDATA.timer){
    var timer = me.CTLDATA.timer[i];
    newhtml += '<tr data-timerid="'+timer.id+'" class="timeritem"><td>'+timer.name+'</td><td><img class="roundbutton-small" src="../app/asset/app/pencil_icon.png"></td></tr>';
  }
  $('.timerlist-inner').html(newhtml).find('.timeritem').click(function(){
    var cid = $(this).data('timerid');
    var timer = getByProperty(me.CTLDATA.timer, 'id', cid);
        
    var data = { "lib": lib, "ctl": id, "timer": timer, "name": timer.name, "data": me.CTLDATA, "ctlapi": me };
    
    $(ME).find('.api-main').css('display', 'none');
    $(ME).find('.api-edittimer').css('display', 'block');
    installControl('.api-edittimer', 'dev', 'edittimer', function(){}, data);
  });
};

me.buildEventList = function(){
  if (me.CTLDATA.event) me.CTLDATA.event.sort((a, b) => (a.name > b.name) ? 1 : -1);
  var newhtml = '';
  for (var i in me.CTLDATA.event){
    var event = me.CTLDATA.event[i];
    newhtml += '<tr data-eventid="'+event.id+'" class="eventitem"><td>'+event.name+'</td><td><img class="roundbutton-small" src="../app/asset/app/pencil_icon.png"></td></tr>';
  }
  $('.eventlist-inner').html(newhtml).find('.eventitem').click(function(){
    var cid = $(this).data('eventid');
    var event = getByProperty(me.CTLDATA.event, 'id', cid);
        
    var data = { "lib": lib, "ctl": id, "event": event, "name": event.name, "data": me.CTLDATA, "ctlapi": me };
    
    $(ME).find('.api-main').css('display', 'none');
    $(ME).find('.api-editevent').css('display', 'block');
    installControl('.api-editevent', 'dev', 'editevent', function(){}, data);
  });
};

me.buildCommandList = function(){
  if (me.CTLDATA.cmd) me.CTLDATA.cmd.sort((a, b) => (a.name > b.name) ? 1 : -1);
  var newhtml = '';
  for (var i in me.CTLDATA.cmd){
    var cmd = me.CTLDATA.cmd[i];
    newhtml += '<tr data-cmdid="'+cmd.id+'" class="cmditem"><td>'+cmd.name+'</td><td><img class="roundbutton-small" src="../app/asset/app/pencil_icon.png"></td></tr>';
  }
  $('.commandlist-inner').html(newhtml).find('.cmditem').click(function(){
    var cid = $(this).data('cmdid');
    json('../app/read', 'lib='+encodeURIComponent(lib)+'&id='+encodeURIComponent(cid), function(result){
      var cmd = getByProperty(me.CTLDATA.cmd, 'id', cid);
      if (result.data){
        result.data.name = cmd.name;
        cmd = result.data;
        cmd.id = cid;
      }
      var data = { "lib": lib, "ctl": id, "cmd": cmd, "name": cmd.name, "data": me.CTLDATA, "ctlapi": me };

      $(ME).find('.api-main').css('display', 'none');
      $(ME).find('.api-editcommand').css('display', 'block');
      installControl('.api-editcommand', 'dev', 'editcommand', function(){}, data);
    });
  });  
};

$(ME).find('.navbar-tab').click(function(){
  var did = $(this).data("id");
  var display = did == "tab1" ? "inline-block" : "none";
  $(ME).find('.previewbutton').css('display', display);
  if (did == "tab2") {
    $(ME).find('.three-main')[0].api.activate();
  }
  else {
    $(ME).find('.three-main')[0].api.deactivate();
  }
});

$(ME).find('.zoomer-pmin').click(function(){
  $('#previewcol').html('');
  var tr1 = $('#previewrow');
  var tr2 = tr1.prev().prev();
  var h1 = tr1.height();
  var h2 = tr2.height();
  tr1.css('height', '0px');
  tr2.css('height', (h1+h2)+'px');
});

$(ME).find('.zoomer-pmax').click(function(){
  var tr1 = $('#previewrow');
  var tr2 = tr1.prev().prev();
  var h1 = tr1.height();
  var h2 = tr2.height();
  tr2.css('height', '0px');
  tr1.css('height', (h1+h2)+'px');
  if (!$("#previewframe")[0]) $('.previewbutton').click(); 
});

$('.previewbutton').click(function(){
  if ($('#previewrow').height() == 0) {
    var tr1 = $('#previewrow');
    var tr2 = tr1.prev().prev();
    var h = (tr1.height() + tr2.height()) / 2;
    tr2.css('height', h+'px');
    tr1.css('height', h+'px');
  }
  buildPreview(lib, id);
});

function buildPreview(DB, CTL, cb) {
  $('#previewcol').html('<iframe src="../dev/preview.html?lib='+lib+'&id='+id+'" style="border:none;width:100%;height:100%;" id="previewframe"></iframe>');
}

$('.zoomer-min').click(function(){
  var td = $(this).closest('td');
  var w = (td.parent().width() -20)/3;
  $('.editor').parent().width(w);
  td.css('width', '20px');
});

$('.zoomer-max').click(function(){
  $('.editor').parent().width('20px');
  var td = $(this).closest('td');
  var w = td.parent().width() - 60;
  td.css('width', w+'px');
});

var elems = $('.grabbybar');
elems.on('mousedown', function(e) {
  var elem = this;
  var td1 = $(elem).parent().parent();
  var td2 = td1.prev();
  var w1 = td1.width();
  var w2 = td2.width();
  
  e = e || window.event;
  var start = 0, diff = 0;
  if( e.pageX) start = e.pageX;
  else if( e.clientX) start = e.clientX;

  elem.style.position = 'relative';
  document.body.onmousemove = function(e) {
      e = e || window.event;
      var end = 0;
      if( e.pageX) end = e.pageX;
      else if( e.clientX) end = e.clientX;

      diff = end-start;
      td1.width((w1-diff)+"px");
      td2.width((w2+diff)+"px");
  };
  document.body.onmouseup = function() {
      elem.style.position = 'static';
      document.body.onmousemove = document.body.onmouseup = null;
  };
});

elems = $('.grabby-v');
elems.on('mousedown', function(e) {
  var elem = this;
  var tr1 = $(elem).parent().parent();
  var tr2 = tr1.prev();
  tr1 = tr1.next();
  var h1 = tr1.height();
  var h2 = tr2.height();
  
  e = e || window.event;
  var start = 0, diff = 0;
  if( e.pageY) start = e.pageY;
  else if( e.clientY) start = e.clientY;

  elem.style.position = 'relative';
  document.body.onmousemove = function(e) {
      e = e || window.event;
      var end = 0;
      if( e.pageY) end = e.pageY;
      else if( e.clientY) end = e.clientY;

      diff = end-start;
    
      tr1.height((h1-diff)+"px");
      tr2.height((h2+diff)+"px");
    
      if (!$("#previewframe")[0]) $('.previewbutton').click(); 
    
      var eds = $('.editor-code-textarea');
      for (var i in eds) if (eds[i].cm) eds[i].cm.refresh();
  };
  document.body.onmouseup = function() {
      // do something with the action here
      // elem has been moved by diff pixels in the X axis
      elem.style.position = 'relative';
      document.body.onmousemove = document.body.onmouseup = null;
  };
});

$.event.special.widthChanged = {
  remove: function() {
    $(this).children('iframe.width-changed').remove();
  },
  add: function () {
    var elm = $(this);
    var iframe = elm.children('iframe.width-changed');
    if (!iframe.length) {
      iframe = $('<iframe/>').addClass('width-changed').prependTo(this);
    }
    var oldWidth = elm.width();
    function elmResized() {
      var width = elm.width();
      if (oldWidth != width) {
        elm.trigger('widthChanged', [width, oldWidth]);
        oldWidth = width;
      }
    }

    var timer = 0;
    var ielm = iframe[0];
    (ielm.contentWindow || ielm).onresize = function() {
      clearTimeout(timer);
      timer = setTimeout(elmResized, 20);
    };
  }
}

$('.editor').on('widthChanged',function(){
  var w = $(this).width();
  if (w<200){
    $(this).find('.editor-code').css('display', 'none');
    $(this).find('.zoomer').css('display', 'none');
    $(this).find('.editor-title').css('transform', 'rotate(90deg)').css('top', '34px').css('left', '-29px');
    $(this).parent().css('width', '20px');
  }
  else{
    $(this).find('.editor-code').css('display', 'block');
    $(this).find('.zoomer').css('display', 'block');
    $(this).find('.editor-title').css('transform', 'rotate(0deg)').css('top', '0px').css('left', '20px');
  }
  
  var eds = $('.editor-code-textarea');
  for (var i in eds) if (eds[i].cm) eds[i].cm.refresh();
});

function buildData(){
  var list = me.CTLDATA.data ? me.CTLDATA.data.slice() : [];
  var dat = {};
  
  function popNext(){
    if (list.length>0){
      var d = list.shift();
      json('../app/read', 'lib='+lib+'&id='+d.id, function(result){
        dat[d.name] = result.data;
        popNext();
      });
    }
    else{
      dat = JSON.stringify(dat, null, 2);
      $(ME).find('.data-textarea').val(dat);
      
      var conf = {
        mode : "javascript",
        theme: cmtheme,
        lineWrapping: true,
        autofocus : false,
        viewportMargin: Infinity,
        onChange: function (cm) { $('.savebutton').removeClass('accentbutton').addClass('coloredbutton'); testData(); }
      };

      var c = $(ME).find('.data-textarea')[0];
      c.cm = CodeMirror.fromTextArea(c, conf);
      c.cm.on('change', function (cm) { me.dirty(); testData(); });
    }
  }
  popNext();
}

function testData(){
  try{
    var dat = JSON.parse($(ME).find('.data-textarea')[0].cm.getValue());
    
    for (var i in dat){
      var d = dat[i];
      if (JSON.stringify(d).charAt(0) != '{') return "Top level attribute "+i+" is not a JSON object. All top level attributes of Control Data must be JSON objects.";
    }
    
    
    $(ME).find('.editor-data').find('.editor-title').css('color', 'white');
    return true
  }
  catch (x) {
    $(ME).find('.editor-data').find('.editor-title').css('color', 'red');
    return "Invalid JSON data";
  }
}

me.buildPublish = function(){
  var data = me.CTLDATA;
  send_appdata(data, function(result){
    console.log(result);
    var d = me.properties = result.data ? result.data : {};
    d.ctlid = data.ctl;
    d.ctldb = data.db; // FIXME - should be lib not db
    
    $('#publishappname').text('Publish '+d.name+' ('+d.ctlid+')');
    $('#pa_name').val(d.name).change(function(){ d.name = $(this).val(); }); //[0].oval = d.name;
    $('#pa_libraries').val(d.libraries).change(function(){ d.libraries = $(this).val(); });
//    $('#pa_index').val(d.index).change(function(){ d.index = $(this).val(); });
    $('#pa_img').val(d.img).change(function(){ d.img = $(this).val(); });
//    $('#pa_class').val(d.botclass).change(function(){ d.botclass = $(this).val(); });  
    $('#pa_desc').val(d.desc).change(function(){ d.desc = $(this).val(); });  
    $('#pa_video').val(d.video).change(function(){ d.video = $(this).val(); });  
    $('#pa_detail').val(d.detail).change(function(){ d.detail = $(this).val(); });  
    $('#pa_subtitle').val(d.subtitle).change(function(){ d.subtitle = $(this).val(); });  
    $('#pa_forsale').prop('checked', d.forsale == 'true').change(function(){ d.name = $(this).prop('checked'); });  
    json('../app/libs', null, function(result){
      me.liblist = result.data;
    });
  });
};

function publishApp() {
  var d = me.properties;
  $(ME).find('.publishoptions').css('display', 'none');
  var newhtml = "<h3>Publishing App: "
  	+ d.name
  	+ "</h3>Checking libraries:"
    + "<div class='padme'>";
  var libs = d.libraries.split(',');
  for (var i in libs) {
  	newhtml +=  "<img src='../app/asset/app/loading.gif' class='roundbutton-small pleasewait'>&nbsp;"
      + libs[i]
      + "<br>";
  }
  newhtml += "</div>";
  var el = $(ME).find('.publishing');
  el.css('display', 'block').html(newhtml);
  
  send_publishapp(me.properties, function(result) {
    if (result.status != 'ok') alert(result.msg);
    else {
      $(ME).find('.publishing').find('.pleasewait').prop('src', '../app/asset/app/check-green.png');
      for (var i in result.data) {
        var lib = getByProperty(me.liblist, "id", result.data);
        var version = lib.version+1;;
        el.append("<b>Library "+lib.id+" v"+version+" published</b><br>");
      }
      el.append('<br><b>Application '+d.name+' v'+(parseInt(d.version)+1)+' published</b>');
      console.log(d);
    }
  });
}
$(ME).find('.publishbutton').click(publishApp);

function saveControl(){
  var x = testData();
  if (x != true) { 
    alert(x); 
    return; 
  }
  
  me.CTLDATA.html = $(ME).find('.html-textarea')[0].cm.getValue();
  me.CTLDATA.css = $(ME).find('.css-textarea')[0].cm.getValue();
  me.CTLDATA.js = $(ME).find('.js-textarea')[0].cm.getValue();
  me.CTLDATA.attachmentkeynames = [ 'html', 'css', 'js' ];

  var readers = $('#ov_groups').val().trim();
  if (readers != '') readers = '&readers='+JSON.stringify(readers.split(','));
  else readers = '&readers=[]';
  

  var dat = JSON.parse($(ME).find('.data-textarea')[0].cm.getValue());
  var datas = [];
  for (var i in dat){
    var d = dat[i];
    var o = getByProperty(me.CTLDATA.data, 'name', i);
    
    var did = o ? o.id : guid();
    var args = 'id='+did+'&lib='+lib+'&data='+encodeURIComponent(JSON.stringify(d))+readers+"&writers=[]";
    json('../app/write', args, function result(){});
    datas.push({"name":i,"id":did});
  } 
  me.CTLDATA.data = datas;
  
  me.CTLDATA.groups = $('#ov_groups').val();
  me.CTLDATA.desc = $('#ov_desc').val();

  json('../app/write', 'lib='+encodeURIComponent(lib)+'&id='+encodeURIComponent(id)+readers+'&writers=[]&data='+encodeURIComponent(JSON.stringify(me.CTLDATA)), function(result){
    if (result.status == 'ok') {
      $('.savebutton').removeClass('coloredbutton').addClass('accentbutton');
    }
    else alert(result.msg);
  });
}
me.saveControl = saveControl;
$('.savebutton').click(me.saveControl);

function dirty() {
  $('.savebutton').removeClass('accentbutton').addClass('coloredbutton');
}

me.dirty = document.body.dirty = dirty;
$(ME).find('#ov_groups').change(me.dirty);
$(ME).find('#ov_desc').change(me.dirty);

me.isCommandEditorActive = function() {
  // Check if the API tab is selected
  const activeTab = $(".navbar-tab.selected").data("id");
  const isApiTabActive = activeTab === "tab3";

  // Check if the command editor section is visible
  const isCommandEditorVisible = $(".api-editcommand").is(":visible");

  return isApiTabActive && isCommandEditorVisible;
};