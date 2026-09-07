var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function(){
  me.build(ME.querySelector(".api-outer"), ME.DATA);
};

me.build = function(el, app){
  var num = 0;
  var tab = document.createElement('table');
  tab.className = 'apitable';
  tab.setAttribute('border', '1');
  tab.setAttribute('cellspacing', '0');
  tab.setAttribute('cellpadding', '3');
  tab.innerHTML = '<tr><th class="apitableth">Command</th><th class="apitableth">Permissions</th><th class="apitableth">Parameters</th><th class="apitableth">Description</th></tr>';
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
      var row = document.createElement('tr');

      row.insertAdjacentHTML('beforeend', '<td>' + x + '</td>');

      var perms = document.createElement('td');
      row.appendChild(perms);
      if (comm.include && comm.include.length>0) { commaList(perms, comm.include, 'include'); perms.insertAdjacentHTML('beforeend', '<br>'); }
      if (comm.exclude && comm.exclude.length>0) commaList(perms, comm.exclude, 'exclude');

      var parms = document.createElement('td');
      row.appendChild(parms);
      var n = comm.parameters.length;
      while (n-->0) if (comm.parameters[n].startsWith('nn_')) comm.parameters.pop(n);
      commaList(parms, comm.parameters, null);

      var desc = document.createElement('td');
      row.appendChild(desc);
      if (comm.desc) desc.insertAdjacentHTML('beforeend', comm.desc);

      (tab.querySelector('tbody') || tab).appendChild(row);
      num++;
    }

  }

  if (num == 0) el.insertAdjacentHTML('beforeend', '<i>There are no commands for this app</i>');
  else el.appendChild(tab);
};

function commaList(el, list, type){
  if (type) el.insertAdjacentHTML('beforeend', '<b>'+type+': </b>');
  for (var x in list) {
    el.insertAdjacentText('beforeend', list[x]);
    if(list.length-1 > x) el.insertAdjacentText('beforeend', ", ");
  }
}
