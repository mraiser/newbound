var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  me.list = ME.DATA.list ? ME.DATA.list : [];
  me.title = ME.DATA.title ? ME.DATA.title : "A List";
  me.itemlib = ME.DATA.itemlib ? ME.DATA.itemlib : "app";
  me.itemctl = ME.DATA.itemctl ? ME.DATA.itemctl : "list_item";  
  me.emptytext = ME.DATA.emptytext ? ME.DATA.emptytext : "<i>No items found.</i>";
  
  me.wrap = $(ME).find(".list_body");
  me.headwrap = $(ME).find(".list_header");
  
  if (ME.DATA.click_add) me.click_add = ME.DATA.click_add;
  else {
    me.click_add_title = ME.DATA.click_add_title ? ME.DATA.click_add_title : "Add" + (ME.DATA.type ? " "+ME.DATA.type : "");
    me.click_add_prompt = ME.DATA.click_add_prompt ? ME.DATA.click_add_prompt : "Give the new "+(ME.DATA.type ? ME.DATA.type.toLowerCase() : "item")+" a name";
    me.default_value = ME.DATA.default_value ? ME.DATA.default_value : "UNTITLED";
  }
  
  me.rebuild();
};

me.rebuild = function(cb){
  me.headwrap.html(me.title);
  if (ME.DATA.allowadd) {
    var el = $('<img src="../app/asset/app/add_icon-white.png" class="addlistitembutton roundbutton">');
    me.headwrap.append(el);
    el.click(function(){
      me.click_add();
    });
  }
  me.wrap.empty();
  if (me.list.length > 0) {
    for (var i in me.list) {
      var li = me.list[i];
      var d = {
        "item": li
      };
      var id = li.id ? li.id : typeof li == "string" ? li : i;
      var el = $("<li data-id='"+id+"'></li>");
      me.wrap.append(el);
      var text = $("<span class='item_cell' />");
      el.append(text);
      if (ME.DATA.click_edit) {
        var b1 = $('<span class="item_cell item_edit" data-index="'+i+'"><img src="../app/asset/app/pencil_icon.png" class="roundbutton-small"></span>');
        el.append(b1);
        b1.click(function(){
          var index = $(this).data('index');
          var val = me.list[index];
          ME.DATA.click_edit(val, index);
        });
      }
      if ((ME.DATA.allowadd || ME.DATA.allowdelete) && !ME.DATA.disallowdelete) {
        var b2 = $('<span class="item_cell item_delete" data-index="'+i+'"><img src="../app/asset/app/delete_icon.png" class="roundbutton-small"></span>');
        el.append(b2);
        b2.click(me.click_delete);
      }
      installControl(text[0], me.itemlib, me.itemctl, function(api){}, d);
    }
  }
  else {
    me.wrap.html('<div class="padme">'+me.emptytext+'</div>');
  }
};

me.delete_item = function(index){
  me.list.pop(index);
  me.rebuild();
  if (ME.DATA.on_delete) ME.DATA.on_delete();
};

me.click_delete = function(){
  var i = $(this).data('index');
  var d = {
    "title": "Delete Item",
    "text": "Are you sure you want to permanently delete this "+(ME.DATA.type ? ME.DATA.type.toLowerCase() : "item")+"?",
    "cb": function(){ me.delete_item(i); }
  };
  document.body.ui.confirm(d);
};

me.set_item = function(d, i){
  me.list[i] = d;
  me.rebuild();
};

me.add_item = function(d){
  me.list.push(d);
  me.rebuild();
};

me.click_add = function(){
  var d = {
    "title": me.click_add_title,
    "value": me.default_value,
    "text": "Name",
    "subtext": me.click_add_prompt,
    "cb": function(val){
      if (me.list.indexOf(val) == -1) {
        me.list.push(val);
        me.rebuild();
      }
      else document.body.ui.snackbarMsg("There is already an item with that name.");
    }
  };
  document.body.ui.prompt(d);
};
