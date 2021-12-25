var me = this;
var ME = $('#'+me.UUID)[0];

var db = 'blockchain';
var id = 'nmqppn1606ab8b19er5b8';

$(ME).find('.menubuttonback').click(function(){ window.location.href='../metabot/index.html?db='+db; });

var cmtheme = typeof CODEMIRRORTHEME != 'undefined' ? CODEMIRRORTHEME : 'abcdef';

me.ready = function(){
  if (getQueryParameter('db') != 'null'){
    db = getQueryParameter('db');
    lookupID(db, getQueryParameter('id'), function(result){
      id = result;
      load();
    });
  }
  else load();
  
  var t = getQueryParameter('tab');
  if (t != 'null') $('#b_'+t).click();
};

$(ME).find('.savebutton').click(saveControl);
$(ME).find('#save-overview-button').click(saveControl);
$(ME).find('#ov_groups').keyup(function(){ $('.savebutton').removeClass('mdl-button--accent').addClass('mdl-button--colored'); });
$(ME).find('#ov_desc').keyup(function(){ $('.savebutton').removeClass('mdl-button--accent').addClass('mdl-button--colored'); });

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

  var dat = JSON.parse($(ME).find('.data-textarea')[0].cm.getValue());
  var datas = [];
  for (var i in dat){
    var d = dat[i];
    var o = getByProperty(me.CTLDATA.data, 'name', i);
    
    var did = o ? o.id : guid();
    var args = 'id='+did+'&db='+db+'&data='+encodeURIComponent(JSON.stringify(d))+readers;
    json('../botmanager/write', args, function result(){});
    datas.push({"name":i,"id":did});
  } 
  me.CTLDATA.data = datas;
  
  me.CTLDATA.groups = $('#ov_groups').val();
  me.CTLDATA.desc = $('#ov_desc').val();

  json('../botmanager/write', 'db='+encodeURIComponent(db)+'&id='+encodeURIComponent(id)+readers+'&data='+encodeURIComponent(JSON.stringify(me.CTLDATA)), function(result){
    if (result.status == 'ok') {
      $('.savebutton').removeClass('mdl-button--colored').addClass('mdl-button--accent');
    }
    else alert(result.msg);
  });
}
me.saveControl = saveControl;


$(ME).find('.addcommandbutton').click(function(){
  var el = $(ME).find('.popupdialog-cmd-name');
  $('.grayout').css('display', 'block');
  el.css('width', '0px').css('height', '0px').css('margin-left', '0px').css('margin-top', '0px').css('border-radius', '40px').css('display', 'block').animate({'width':'400px', 'height':'240px', 'margin-left':'-200px', 'margin-top':'-90px', 'border-radius': '0px'},500,function(){});
});

$(ME).find('.addtimerbutton').click(function(){
  var el = $(ME).find('.popupdialog-timer-name');
  $('.grayout').css('display', 'block');
  el.css('width', '0px').css('height', '0px').css('margin-left', '0px').css('margin-top', '0px').css('border-radius', '40px').css('display', 'block').animate({'width':'400px', 'height':'240px', 'margin-left':'-200px', 'margin-top':'-90px', 'border-radius': '0px'},500,function(){});
});

$(ME).find('.addeventbutton').click(function(){
  var el = $(ME).find('.popupdialog-event-name');
  $('.grayout').css('display', 'block');
  el.css('width', '0px').css('height', '0px').css('margin-left', '0px').css('margin-top', '0px').css('border-radius', '40px').css('display', 'block').animate({'width':'400px', 'height':'240px', 'margin-left':'-200px', 'margin-top':'-90px', 'border-radius': '0px'},500,function(){});
});

function addTimer(){
  if ($(ME).find('.addthetimer').hasClass('mdl-button--colored')){
    var name = $('#newtimername').val();
    if (name == '') error('You must name this timer task');
    else if (getByProperty(me.CTLDATA.timer, 'name', name) != null) alert('There is already a timer task with that name');
    else {
  //    info('<i>Adding new timer task...</i>');
      var data = {};
      json('../botmanager/write', 'db='+db+'&data='+encodeURIComponent(JSON.stringify(data)), function(result){
        if (result.status != 'ok') alert(result.msg);
        else{
          data.name = name;
          data.id = result.id;
          if (!me.CTLDATA.timer) me.CTLDATA.timer = [];
          me.CTLDATA.timer.push(data);
          saveControl();
          me.buildTimerList();
          $(ME).find('.popupdialog-timer-name-close').click();
  //        editTimer(data.id, saveTimer);
        }
      });
    }
  }
}
$(ME).find('.addthetimer').click(addTimer);

function addEvent(){
  if ($(ME).find('.addtheevent').hasClass('mdl-button--colored')){
    var name = $('#neweventname').val();
    if (name == '') error('You must name this event task');
    else if (getByProperty(me.CTLDATA.event, 'name', name) != null) alert('There is already a event task with that name');
    else {
  //    info('<i>Adding new event task...</i>');
      var data = {};
      json('../botmanager/write', 'db='+db+'&data='+encodeURIComponent(JSON.stringify(data)), function(result){
        if (result.status != 'ok') alert(result.msg);
        else{
          data.name = name;
          data.id = result.id;
          if (!me.CTLDATA.event) me.CTLDATA.event = [];
          me.CTLDATA.event.push(data);
          saveControl();
          me.buildEventList();
          $(ME).find('.popupdialog-event-name-close').click();
  //        editEvent(data.id, saveEvent);
        }
      });
    }
  }
}
$(ME).find('.addtheevent').click(addEvent);

$(ME).find('.navbutton').click(function(){
  $(ME).find('.navbutton').removeClass('selected');
  $(this).addClass('selected').blur();
  $(ME).find('.navtab').css('display', 'none');
  $(ME).find('.'+this.id.substring(2)).css('display', 'block');
  $(window).resize();

  $('.dg.ac').css('display', 'none');
});

function load(){
  json('../botmanager/read', 'db='+db+'&id='+id, function(result){
      me.build(result);
      installControl('.publish', 'metabot', 'publishapp', function(){
//        componentHandler.upgradeAllRegistered();
      }, me.CTLDATA);
  });
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

function buildData(){
  var list = me.CTLDATA.data ? me.CTLDATA.data.slice() : [];
  var dat = {};
  
  function popNext(){
    if (list.length>0){
      var d = list.shift();
      json('../botmanager/read', 'db='+db+'&id='+d.id, function(result){
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
        onChange: function (cm) { $('.savebutton').removeClass('mdl-button--accent').addClass('mdl-button--colored'); testData(); }
      };

      var c = $(ME).find('.data-textarea')[0];
      c.cm = CodeMirror.fromTextArea(c, conf);
      c.cm.on('change', function (cm) { $('.savebutton').removeClass('mdl-button--accent').addClass('mdl-button--colored'); testData(); });
    }
  }
  popNext();
}

me.build = function(result){  
  result.data.db = db;
  result.data.ctl = id;
  me.CTLDATA = result.data;
//  $(ME).find('.currentcontrolid').text(id);
  $(ME).find('.ctl-lib').text(db);
  $(ME).find('.ctl-name').text(result.data.name);
  $(ME).find('.html-textarea').val(result.data.html);
  $(ME).find('.css-textarea').val(result.data.css);
  $(ME).find('.js-textarea').val(result.data.js);
  $(ME).find('#ov_groups').val(result.data.groups);
  $(ME).find('#ov_desc').val(result.data.desc);
  
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
  c.cm.on('change', function (cm) { $('.savebutton').removeClass('mdl-button--accent').addClass('mdl-button--colored'); testData(); });
  
  c = $(ME).find('.css-textarea')[0];
  conf.mode='css';
  c.cm = CodeMirror.fromTextArea(c, conf);
  c.cm.on('change', function (cm) { $('.savebutton').removeClass('mdl-button--accent').addClass('mdl-button--colored'); testData(); });
  
  c = $(ME).find('.js-textarea')[0];
  conf.mode='javascript';
  c.cm = CodeMirror.fromTextArea(c, conf);
  c.cm.on('change', function (cm) { $('.savebutton').removeClass('mdl-button--accent').addClass('mdl-button--colored'); testData(); });
  
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

  me.buildCommandList();
  me.buildTimerList();
  me.buildEventList();
  
  $("#b_api").click(function(e){
//    var el = $(ME).find('.three-main');
//    el.empty();
  })
  $("#b_three").click(function(e){
//    var el = $(ME).find('.three-main');
//    el.empty();
//    installControl(el[0], 'metabot', 'edit3d', function(api){ api.editor = me; }, me.CTLDATA);
  });
  
  installControl($(ME).find('.three-main')[0], 'metabot', 'edit3d', function(api){ api.editor = me; }, me.CTLDATA);
};

me.buildEventList = function(){
  var newhtml = '';
  for (var i in me.CTLDATA.event){
    var event = me.CTLDATA.event[i];
    newhtml += '<tr data-eventid="'+event.id+'" class="eventitem"><td class="mdl-data-table__cell--non-numeric">'+event.name+'</td><td class="mdl-data-table__cell--non-numeric"><i class="mdc-list-item__graphic material-icons" aria-hidden="true">edit</i></td></tr>';
  }
  $('.eventlist-inner').html(newhtml);
  $(ME).find('.eventitem').click(function(){
    var cid = $(this).data('eventid');
    var event = getByProperty(me.CTLDATA.event, 'id', cid);
        
    var data = { "db": db, "ctl": id, "event": event, "name": event.name, "data": me.CTLDATA, "ctlapi": me };
    
    $(ME).find('.api-main').css('display', 'none');
    $(ME).find('.api-editevent').css('display', 'block');
    installControl('.api-editevent', 'metabot', 'editevent', function(){}, data);
  });
};

me.buildTimerList = function(){
  var newhtml = '';
  for (var i in me.CTLDATA.timer){
    var timer = me.CTLDATA.timer[i];
    newhtml += '<tr data-timerid="'+timer.id+'" class="timeritem"><td class="mdl-data-table__cell--non-numeric">'+timer.name+'</td><td class="mdl-data-table__cell--non-numeric"><i class="mdc-list-item__graphic material-icons" aria-hidden="true">edit</i></td></tr>';
  }
  $('.timerlist-inner').html(newhtml);
  $(ME).find('.timeritem').click(function(){
    var cid = $(this).data('timerid');
    var timer = getByProperty(me.CTLDATA.timer, 'id', cid);
        
    var data = { "db": db, "ctl": id, "timer": timer, "name": timer.name, "data": me.CTLDATA, "ctlapi": me };
    
    $(ME).find('.api-main').css('display', 'none');
    $(ME).find('.api-edittimer').css('display', 'block');
    installControl('.api-edittimer', 'metabot', 'edittimer', function(){}, data);
  });
};

me.buildCommandList = function(){
  var newhtml = '';
  for (var i in me.CTLDATA.cmd){
    var cmd = me.CTLDATA.cmd[i];
    newhtml += '<tr data-cmdid="'+cmd.id+'" class="cmditem"><td class="mdl-data-table__cell--non-numeric">'+cmd.name+'</td><td class="mdl-data-table__cell--non-numeric"><i class="mdc-list-item__graphic material-icons" aria-hidden="true">edit</i></td></tr>';
  }
  $('.commandlist-inner').html(newhtml);
  $(ME).find('.cmditem').click(function(){
    var cid = $(this).data('cmdid');
    json('../botmanager/read', 'db='+encodeURIComponent(db)+'&id='+encodeURIComponent(cid), function(result){
      var cmd = getByProperty(me.CTLDATA.cmd, 'id', cid);
      if (result.data){
        result.data.name = cmd.name;
        cmd = result.data;
        cmd.id = cid;
      }
      var data = { "db": db, "ctl": id, "cmd": cmd, "name": cmd.name, "data": me.CTLDATA, "ctlapi": me };

      $(ME).find('.api-main').css('display', 'none');
      $(ME).find('.api-editcommand').css('display', 'block');
      installControl('.api-editcommand', 'metabot', 'editcommand', function(){}, data);
    });
  });
};

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
  if ($('#previewrow').height() == 0) $('#previewrow').css('height', '50%');
  $('#previewcol').html('<iframe src="../botmanager/shell.html" style="border:none;width:100%;height:100%;" id="previewframe"></iframe>');
  $("#previewframe").contents().find("body").html('');
  buildPreview(db, id);
});

function buildPreview(DB, CTL, cb) {
  $('#previewframe').prop('src', $('#previewframe').prop('src'));
  setTimeout(function(){
	$('#previewframe')[0].contentWindow.installControl('body', DB, CTL, cb);
	$(window).resize();
  }, 500);
  
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

function closeAddTimerDialog(){
  var el = $(ME).find('.popupdialog-timer-name');
  el.animate({'width':'0px', 'height':'0px', 'margin-left':'0px', 'margin-top':'0px', 'border-radius': '40px'},500,function(){
    el.css('display', 'none');
  });
  $('.grayout').css('display', 'none');
}

$(ME).find('.popupdialog-timer-name-close').click(closeAddTimerDialog);

function closeAddEventDialog(){
  var el = $(ME).find('.popupdialog-event-name');
  el.animate({'width':'0px', 'height':'0px', 'margin-left':'0px', 'margin-top':'0px', 'border-radius': '40px'},500,function(){
    el.css('display', 'none');
  });
  $('.grayout').css('display', 'none');
}

$(ME).find('.popupdialog-event-name-close').click(closeAddEventDialog);

function closeAddDialog(){
  var el = $(ME).find('.popupdialog-cmd-name');
  el.animate({'width':'0px', 'height':'0px', 'margin-left':'0px', 'margin-top':'0px', 'border-radius': '40px'},500,function(){
    el.css('display', 'none');
  });
  $('.grayout').css('display', 'none');
}

$(ME).find('.popupdialog-cmd-name-close').click(closeAddDialog);

$(ME).find('.addthecmd').click(function(){
  if ($(this).hasClass('mdl-button--colored')){
    var name = $(ME).find('#newcommandname').val();
    if (getByProperty(me.CTLDATA.cmd, 'name', name) != null) alert('There is already a command with that name');
    else{
      var data = { java: 'return null;' };
      json('../botmanager/write', 'db='+db+'&data='+encodeURIComponent(JSON.stringify(data)), function(result){
        if (result.status != 'ok') alert(result.msg);
        else {
          data.name = name;
          data.java = result.id;

          json('../botmanager/write', 'db='+db+'&data='+encodeURIComponent(JSON.stringify(data)), function(result){
            if (result.status != 'ok') error(result.msg);
            else{
              data.id = result.id;
              if (!me.CTLDATA.cmd) me.CTLDATA.cmd = [];
              me.CTLDATA.cmd.push(data);
              saveControl();
              me.buildCommandList();
              closeAddDialog();
            }
          });
        }
      });
    }
  }
});

var validchars = 'abcdefghijklmnopqrstuvwxyz_0123456789';

function checkname(a, b){
  var s = $(ME).find(a).val();
  var i = s.length;
  if (i == 0) return false;
  
  var bool = true;
  while (i-->0) if (validchars.indexOf(s.charAt(i)) == -1) { bool = false; break; }
  if (bool) $(ME).find(b).removeClass('mdl-button--accent').addClass('mdl-button--colored').removeAttr('disabled');
  else $(ME).find(b).removeClass('mdl-button--colored').addClass('mdl-button--accent').prop('disabled', 'true');
};

function checkcmdname(){ checkname('#newcommandname', '.addthecmd'); }
function checktimername(){ checkname('#newtimername', '.addthetimer'); }
function checkeventname(){ checkname('#neweventname', '.addtheevent'); }
  
$(ME).find('#newcommandname').change(checkcmdname);
$(ME).find('#newcommandname').keyup(checkcmdname);

$(ME).find('#newtimername').change(checktimername);
$(ME).find('#newtimername').keyup(checktimername);

$(ME).find('#neweventname').change(checkeventname);
$(ME).find('#neweventname').keyup(checkeventname);


















