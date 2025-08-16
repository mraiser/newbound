var me = this;
var ME = $('#'+me.UUID)[0];
var cmtheme = 'default';
var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';
var lib = getQueryParameter('lib');
var id = getQueryParameter('id');

me.ready = function(api){
}

/**
 * Helper function to refresh all CodeMirror instances on the page.
 * This is crucial for fixing display/cursor alignment issues after layout changes.
 */
function refreshAllCodeMirrors() {
  var eds = $(ME).find('.editor-code-textarea');
  for (var i = 0; i < eds.length; i++) {
    if (eds[i].cm) {
      eds[i].cm.refresh();
    }
  }
}

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  ui.initNavbar(ME);

  // --- Dark Mode Logic ---
  const darkModePref = localStorage.getItem('darkMode');
  if (darkModePref === 'enabled') {
    $('body').addClass('dark');
  }
  cmtheme = (darkModePref === 'enabled') ? 'darcula' : 'default';
  // --- End Dark Mode Logic ---

  /**
   * Hides editor panes that do not have content on initial load.
   */
  function hideEmptyPanes() {
    var data = me.data;
    var editors = [];

    // get the editors
    var ehtm = $(ME).find('.editor-html');
    var ecss = $(ME).find('.editor-css');
    var ejs = $(ME).find('.editor-js');
    var ed = $(ME).find('.editor-data');


    // Build a list of editors that have content
    if (data.html && data.html.trim().length > 0) editors.push(ehtm);
    if (data.css && data.css.trim().length > 0) editors.push(ecss);
    if (data.js && data.js.trim().length > 0) editors.push(ejs);
    if (me.CTLDATA.data && me.CTLDATA.data.length > 0) editors.push(ed);
    if (editors.length == 0) editors = [ ehtm, ecss, ejs ];

    // Hide all editor <td>s first
    $(ME).find('.editor').parent('td').css('display', 'none');

    // Show only non-empty panes and set their width
    if (editors.length > 0) {
      var width = 100 / editors.length;
      editors.forEach(function($editor) {
        $editor.parent('td').css({
          'display': 'table-cell',
          'width': width + '%'
        });
      });
    }
    refreshAllCodeMirrors();
  }

  /**
   * Resets the editor layout to show all panes equally.
   */
  function resetEditorLayout() {
    var allTds = $(ME).find('.editor').parent('td');
    allTds.removeClass('is-maximized'); // Remove maximized class
    allTds.css({
      'display': 'table-cell',
      'width': '25%'
    });
    refreshAllCodeMirrors();
  }

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
        viewportMargin: Infinity
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

      hideEmptyPanes();

      // Initially hide the preview pane
      $(ME).find('.zoomer-pmin').click();

      me.buildCommandList();
      me.buildTimerList();
      me.buildEventList();
      me.buildPublish();
      me.build3D();
    });
  });

  $(ME).find('.backbutton').click(function(){ window.location.href='../dev/index.html?lib='+lib; });
  $(ME).find('.reset-layout-button').click(resetEditorLayout);
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
    "ok":"Add",
    "cancel":"Cancel",
    "clientX":e.clientX,
    "clientY":e.clientY,
    "validate":function(name) {
      if (validateName(name)) {
        if (me.CTLDATA.timer && getByProperty(me.CTLDATA.timer, 'name', name) != null) {
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
    "ok":"Add",
    "cancel":"Cancel",
    "clientX":e.clientX,
    "clientY":e.clientY,
    "validate":function(name) {
      if (validateName(name)) {
        if (me.CTLDATA.event && getByProperty(me.CTLDATA.event, 'name', name) != null) {
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
    "ok":"Add",
    "cancel":"Cancel",
    "clientX":e.clientX,
    "clientY":e.clientY,
    "validate":function(name) {
      if (validateName(name)) {
        if (me.CTLDATA.cmd && getByProperty(me.CTLDATA.cmd, 'name', name) != null) {
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
    newhtml += '<tr data-timerid="'+timer.id+'" class="timeritem"><td>'+timer.name+'</td><td><button class="edit-icon-button"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg></button></td></tr>';
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
    newhtml += '<tr data-eventid="'+event.id+'" class="eventitem"><td>'+event.name+'</td><td><button class="edit-icon-button"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg></button></td></tr>';
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
    newhtml += '<tr data-cmdid="'+cmd.id+'" class="cmditem"><td>'+cmd.name+'</td><td><button class="edit-icon-button"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg></button></td></tr>';
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
  var display = did == "tab1" ? "flex" : "none";
  $(ME).find('.toprighthugger .regularbutton').css('display', display);
  if (did == "tab2") {
    $(ME).find('.three-main')[0].api.activate();
  }
  else {
    $(ME).find('.three-main')[0].api.deactivate();
  }
  refreshAllCodeMirrors();
});
$(ME).find('.zoomer-pmin').click(function(){
  $('#previewcol').html('');
  var tr1 = $('#previewrow');
  var tr2 = tr1.prev().prev();
  tr1.css('height', '0px');
  tr2.css('height', '100%');
  refreshAllCodeMirrors();
});
$(ME).find('.zoomer-pmax').click(function(){
  var tr1 = $('#previewrow');
  var tr2 = tr1.prev().prev();
  tr2.css('height', '0px');
  tr1.css('height', '100%');
  if (!$("#previewframe")[0]) $('.previewbutton').click();
  refreshAllCodeMirrors();
});
$('.previewbutton').click(function(){
  if ($('#previewrow').height() == 0) {
    var tr1 = $('#previewrow');
    var tr2 = tr1.prev().prev();
    tr2.css('height', '50%');
    tr1.css('height', '50%');
  }
  buildPreview(lib, id);
  refreshAllCodeMirrors();
});
function buildPreview(DB, CTL, cb) {
  $('#previewcol').html('<iframe src="../dev/preview.html?lib='+lib+'&id='+id+'" style="border:none;width:100%;height:100%;" id="previewframe"></iframe>');
}
$('.zoomer-min').click(function(){
  var td = $(this).closest('td');
  td.css('display', 'none');
  var allTds = td.parent().children('td');
  var visibleTds = allTds.filter(function() { return $(this).css('display') !== 'none'; });
  if (visibleTds.length === 0) {
    td.css('display', 'table-cell'); // Don't allow hiding the last one
    return;
  }
  var newWidth = 100 / (visibleTds.length);
  visibleTds.css('width', newWidth + '%');
  refreshAllCodeMirrors();
});
$('.zoomer-max').click(function(){
  var td = $(this).closest('td');
  var allTds = td.parent().children('td');
  allTds.removeClass('is-maximized');
  td.addClass('is-maximized');
  allTds.not(td).css('display', 'none');
  td.css('display','table-cell').css('width', '100%');
  refreshAllCodeMirrors();
});

$('.unzoom-button').click(function() {
  var allTds = $(ME).find('.editor').parent('td');
  allTds.removeClass('is-maximized');

  var visiblePanes = [];
  if (me.data.html && me.data.html.trim().length > 0) visiblePanes.push(allTds.has('.editor-html'));
  if (me.data.css && me.data.css.trim().length > 0) visiblePanes.push(allTds.has('.editor-css'));
  if (me.data.js && me.data.js.trim().length > 0) visiblePanes.push(allTds.has('.editor-js'));
  if (me.CTLDATA.data && me.CTLDATA.data.length > 0) visiblePanes.push(allTds.has('.editor-data'));

  if (visiblePanes.length === 0) { // If all were empty, show all
    allTds.css({'display': 'table-cell', 'width': '25%'});
  } else {
    var width = 100 / visiblePanes.length;
    allTds.css('display', 'none');
    visiblePanes.forEach(function($td) {
      $td.css({'display': 'table-cell', 'width': width + '%'});
    });
  }
  refreshAllCodeMirrors();
});


var elems = $('.grabbybar');
elems.on('mousedown', function(e) {
  var elem = this;
  var td1 = $(elem).closest('td');
  var td2 = td1.prev();
  var w1 = td1.width();
  var w2 = td2.width();

  e = e || window.event;
  var start = 0, diff = 0;
  if( e.pageX) start = e.pageX;
  else if( e.clientX) start = e.clientX;
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
    document.body.onmousemove = document.body.onmouseup = null;
    refreshAllCodeMirrors();
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
  var totalHeight = h1 + h2;

  e = e || window.event;
  var start = 0, diff = 0;
  if( e.pageY) start = e.pageY;
  else if( e.clientY) start = e.clientY;
  document.body.onmousemove = function(e) {
    e = e || window.event;
    var end = 0;
    if( e.pageY) end = e.pageY;
    else if( e.clientY) end = e.clientY;
    diff = end-start;

    tr1.height((h1-diff)+"px");
    tr2.height((h2+diff)+"px");

    if (!$("#previewframe")[0] && tr1.height() > 0) $('.previewbutton').click();

    refreshAllCodeMirrors();
  };
  document.body.onmouseup = function() {
    document.body.onmousemove = document.body.onmouseup = null;
    refreshAllCodeMirrors();
  };
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
        mode : {name: "javascript", json: true},
        theme: cmtheme,
        lineWrapping: true,
        autofocus : false,
        viewportMargin: Infinity
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
    $(ME).find('.editor-data .editor-header').css('color', 'white');
    return true
  }
  catch (x) {
    $(ME).find('.editor-data .editor-header').css('color', 'red');
    return "Invalid JSON data";
  }
}
me.buildPublish = function(){
  var data = me.CTLDATA;
  send_appdata(data, function(result){
    var d = me.properties = result.data ? result.data : {};
    d.ctlid = data.ctl;
    d.ctldb = data.db;

    $('#publishappname').text('Publish '+d.name+' ('+d.ctlid+')');
    $('#pa_name').val(d.name).change(function(){ d.name = $(this).val(); });
    $('#pa_libraries').val(d.libraries).change(function(){ d.libraries = $(this).val(); });
    $('#pa_img').val(d.img).change(function(){ d.img = $(this).val(); });
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
    newhtml += "<img src='../app/asset/app/loading.gif' class='roundbutton-small-white pleasewait'>&nbsp;"
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
    }
  });
}
$(ME).find('.publishbutton').click(publishApp);
function saveControl(){
  var x = testData();
  if (x != true) {
    me.ui.snackbarMsg(x, "400px", true);
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
      $('.savebutton').removeClass('coloredbutton').addClass('regularbutton');
      me.ui.snackbarMsg("Control Saved");
    }
    else alert(result.msg);
  });
}
me.saveControl = saveControl;
$('.savebutton').click(me.saveControl);
function dirty() {
  $('.savebutton').removeClass('regularbutton').addClass('coloredbutton');
}
me.dirty = document.body.dirty = dirty;
$(ME).find('#ov_groups').change(me.dirty);
$(ME).find('#ov_desc').change(me.dirty);
me.isCommandEditorActive = function() {
  const activeTab = $(".navbar-tab.selected").data("id");
  const isApiTabActive = activeTab === "tab3";
  const isCommandEditorVisible = $(".api-editcommand").is(":visible");
  return isApiTabActive && isCommandEditorVisible;
};
