var me = this;
var ME = $('#'+me.UUID)[0];

var card = $(ME).find('.appinstaller');

var app = ME.DATA;
var peer = app.selectedpeer ? app.selectedpeer : app.peers[0];
var rapp = getByProperty(peer.apps.list, 'id', app.id);
var installed = 0;
var count = 0;

//FIXME - add code on fail

me.wscb = function(data){
  if (data.msg) card.find('.libmsg2').html(data.msg);
  if (data.percent) {
    card.find('.libprogbar')[0].indeterminate = false;
    card.find('.libprogbar').css('width', data.percent+'%');
    
    var n = count; //rapp.libraries.length;
    var p = (50 + (100*installed) + data.percent) / (n+1);
    card.find('.appprogbar').css('width', p+'%');
    card.find('.appmsg2').html('Installing Library '+(installed+1)+' of '+n+'...');
  }
};

function handleError(){
  card.find('.appprogbar')[0].indeterminate = false;
  card.find('.libprogbar')[0].indeterminate = false;
  card.find('.appprog').animate({'height':'0px'}, 1000);
  card.find('.libprog').animate({'height':'0px'}, 1000, function(){
    $(ME).find('.tryagain').css('display', 'inline-block');
    $(ME).find('.cancelinstall').css('display', 'inline-block');
  });
}

me.ready = function(){
  
  card.animate({'width':'80px','height':'80px', 'border-radius':'40px', 'top':'0px', 'left':'0px'},500, function(){
    card.animate({'width':'100%','height':'120px', 'border-radius':'0px'},2000, function(){
      install();
    });
  });
};

function install(){      
  peer = app.selectedpeer ? app.selectedpeer : app.peers[0];
  rapp = getByProperty(peer.apps.list, 'id', app.id);
  installed = 0;
  
  $(ME).find('.tryagain').css('display', 'none');
  $(ME).find('.cancelinstall').css('display', 'none');
  card.find('.appmsg1').html('Installing App '+rapp.name+' v'+rapp.version+' from '+peer.name+' ('+peer.id+')');
  card.find('.appmsg2').html('Requesting app metadata...');
  card.find('.libmsg2').html('');
  card.find('.appprog').animate({'height':'5px'}, 1000);
  indeterminate(card.find('.appprogbar')[0]);
  json('../peerbot/remote/'+peer.id+'/metabot/libraries', null, function(result){

    if (result.status != 'ok') {
      card.find('.appmsg2').html('Error requesting app metadata.');
      handleError();
      return;
    }

    var libs = [];
    for (var i in rapp.libraries){
      var a = rapp.libraries[i]
      var a1 = getByProperty(document.body.libraries, 'id', a);
      var a2 = getByProperty(result.data.data.list, 'id', a);
      
      if (a2) {
        if (!a1 || (Number(a2.version)>Number(a1.version))) libs.push(a);
      }
      else {
        card.find('.appmsg2').html('Missing library '+lib.name+' v'+lib.version+' from '+peer.name+' ('+peer.id+')');
        handleError();
        return;
      }
    }
    count = libs.length;

    function send_install(appinfo, cb){
      var ps = appinfo.peers;
      var sp = appinfo.selectedpeer;
      appinfo.peers = [];
      appinfo.selectedpeer = null;
      var args = {appinfo: appinfo};
      args = encodeURIComponent(JSON.stringify(args));
      json('../botmanager/execute', 'db=metabot&id=utursv16172165563k55&args='+args, function(result){
        
        if (result.status != 'ok') {
          card.find('.appmsg2').html('Error updating app metadata.');
          handleError();
          return;
        }

        cb(result);
      });
      appinfo.peers = ps;
      appinfo.selectedpeer = sp;
    }

    function done(){
      card.find('.libprog').animate({'height':'0px'}, 1000, function(){
        card.find('.libmsg1').html('');
        card.find('.libmsg2').html('');
      });

      card.find('.appmsg2').html('Finishing installation...');
      send_install(rapp, function(result){
        
        if (result.status != 'ok') {
          card.find('.appmsg2').html('Error installing app.');
          handleError();
          return;
        }

        card.find('.appmsg2').html('Installation complete.');
        card.find('.appprogbar').css('width', '100%');

        closeDialog(ME.DATA.cb);
      });
    }

    function popNext(){
      if (libs.length>0){
        card.find('.appprogbar')[0].indeterminate = false;
        var rlib = libs.shift();
        var lib = getByProperty(result.data.data.list, 'id', rlib);
        if (true) { //(Number(rlib.version)>Number(lib.version)){
          card.find('.appmsg2').html('Installing Library '+lib.name+'...');
          card.find('.libmsg1').html('Installing Library '+lib.name+' v'+lib.version+' from '+peer.name+' ('+peer.id+')');
          card.find('.libmsg2').html('');
          card.find('.libprog').animate({'height':'5px'}, 1000);
          indeterminate(card.find('.libprogbar')[0]);
          json('../metabot/installlib', 'guid='+me.UUID+'&peer='+encodeURIComponent(peer.id)+'&lib='+encodeURIComponent(lib.id), function(result){

            if (result.status != 'ok') {
              card.find('.appmsg2').html('Error installing library '+lib.name+' v'+lib.version+' from '+peer.name+' ('+peer.id+')');
              card.find('.libmsg1').html('');
              card.find('.libmsg2').html('');
              handleError();
              return;
            }
            else{
              installed++;
              popNext();
            }
          });
        }
        else {
          installed++;
          popNext();
        }
      }
      else done();
    }
    popNext();
  });
};

function indeterminate(progbar){
  progbar.indeterminate = true;
  var dur = 800;
  $(progbar).css('left', '-50%').css('width', '50%').animate({'left':'100%'},dur, function(){
    function update(){
      if (progbar.indeterminate){
        dur = dur == 800 ? 1500 : 800;
        $(progbar).css('left', '-50%').animate({'left':'100%'},dur, update);
      }
      else $(progbar).css('left', '0%').css('width', '0%');
    }
    update();
  });
  
}

function closeDialog(cb){
  $(ME).find('.tryagain').css('display', 'none');
  $(ME).find('.cancelinstall').css('display', 'none');
  card.find('.appprog').animate({'height':'0px'}, 1000, function(){
    card.find('.appmsg1').html('');
    card.find('.appmsg2').html('');

    card.animate({'width':'80px','height':'80px', 'border-radius':'40px'},2000, function(){
        $('.appactions').css('display', 'block');
      card.animate({'width':'0px','height':'0px', 'border-radius':'0px', 'top':'40px', 'left':'40px'},500, function(){
        if (cb) cb();
      });
    });
  });
}
    
$(ME).find('.tryagain').click(install);
$(ME).find('.cancelinstall').click(closeDialog);