var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  me.build($(ME).find(".api-outer"), ME.DATA);
  
  
  
};

me.build = function(el, app){
  var num = 0;
  var tab = $('<table class="apitable" border="1" cellspacing="0" cellpadding="3"><tr><th class="apitableth">Command</th><th class="apitableth">Permissions</th><th class="apitableth">Parameters</th><th class="apitableth">Description</th></tr></table>');
  console.log(app);

  if (app.commands) {

    var list = [];
    for (var x in app.commands) list.push(x);
    
    function compare(a,b) {
      if (a.toLowerCase() < b.toLowerCase())
        return -1;
      if (a.toLowerCase() > b.toLowerCase())
        return 1;
      return 0;
    }
    
    list.sort(compare);
        
    for (var i in list) {
      var x = list[i];
      var comm = app.commands[x];
      var row = $('<tr/>');
      
      row.append('<td>' + x + '</td>');
      
      var perms = $('<td/>')[0];
      row.append(perms);
      if (comm.include && comm.include.length>0) { commaList(perms, comm.include, 'include'); $(perms).append('<br>'); }
      if (comm.exclude && comm.exclude.length>0) commaList(perms, comm.exclude, 'exclude');
      
      var parms = $('<td/>')[0];
      row.append(parms);
      var n = comm.parameters.length;
      while (n-->0) if (comm.parameters[n].startsWith('nn_')) comm.parameters.pop(n);
      commaList(parms, comm.parameters, null);
      
      var desc = $('<td/>')[0];
      row.append(desc);
      if (comm.desc) $(desc).append(comm.desc);
      
      $(tab).find('tbody').append(row);
      num++;
    }

  }

  if (num == 0) $(el).append('<i>There are no commands for this app</i>');
  else $(el).append(tab);
};

function commaList(el, list, type){
  if (type) $(el).append('<b>'+type+': </b>');
  for (var x in list) {
    $(el).append(list[x]);
    if(list.length-1 > x) $(el).append(", ");
  }
}