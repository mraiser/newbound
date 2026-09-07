var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function() {
  me.list = ME.DATA.list ? ME.DATA.list : [];
  me.title = ME.DATA.title ? ME.DATA.title : "A List";
  me.itemlib = ME.DATA.itemlib ? ME.DATA.itemlib : "app";
  me.itemctl = ME.DATA.itemctl ? ME.DATA.itemctl : "list_item";
  me.emptytext = ME.DATA.emptytext ? ME.DATA.emptytext : "<i>No items found.</i>";

  me.wrap = ME.querySelector(".list_body");
  me.headwrap = ME.querySelector(".list_header");

  if (ME.DATA.click_add) me.click_add = ME.DATA.click_add;
  else {
    me.click_add_title = ME.DATA.click_add_title ? ME.DATA.click_add_title : "Add" + (ME.DATA.type ? " " + ME.DATA.type : "");
    me.click_add_prompt = ME.DATA.click_add_prompt ? ME.DATA.click_add_prompt : "Give the new " + (ME.DATA.type ? ME.DATA.type.toLowerCase() : "item") + " a name";
    me.default_value = ME.DATA.default_value ? ME.DATA.default_value : "UNTITLED";
  }

  me.rebuild();
};

me.rebuild = function(cb) {
  me.headwrap.innerHTML = me.title;
  if (ME.DATA.allowadd) {
    var addbtn = document.createElement('img');
    addbtn.src = "../app/asset/app/add_icon-white.png";
    addbtn.className = "addlistitembutton roundbutton";
    me.headwrap.appendChild(addbtn);
    addbtn.addEventListener('click', function() {
      me.click_add();
    });
  }
  me.wrap.innerHTML = '';
  if (me.list.length > 0) {
    for (var i in me.list) {
      var li = me.list[i];
      var d = {
        "item": li
      };
      var id = li.id ? li.id : typeof li == "string" ? li : i;
      var el = document.createElement('li');
      el.dataset.id = id;
      me.wrap.appendChild(el);
      var text = document.createElement('span');
      text.className = 'item_cell';
      el.appendChild(text);
      if (ME.DATA.click_edit) {
        var b1 = document.createElement('span');
        b1.className = 'item_cell item_edit';
        b1.dataset.index = i;
        b1.innerHTML = '<img src="../app/asset/app/pencil_icon.png" class="roundbutton-small">';
        el.appendChild(b1);
        b1.addEventListener('click', function() {
          var index = this.dataset.index;
          var val = me.list[index];
          ME.DATA.click_edit(val, index);
        });
      }
      if ((ME.DATA.allowadd || ME.DATA.allowdelete) && !ME.DATA.disallowdelete) {
        var b2 = document.createElement('span');
        b2.className = 'item_cell item_delete';
        b2.dataset.index = i;
        b2.innerHTML = '<img src="../app/asset/app/delete_icon.png" class="roundbutton-small">';
        el.appendChild(b2);
        b2.addEventListener('click', me.click_delete);
      }
      installControl(text, me.itemlib, me.itemctl, function(api) {}, d);
    }
  }
  else {
    me.wrap.innerHTML = '<div class="padme">' + me.emptytext + '</div>';
  }
};

me.delete_item = function(index) {
  me.list.pop(index);
  me.rebuild();
  if (ME.DATA.on_delete) ME.DATA.on_delete();
};

me.click_delete = function() {
  var i = this.dataset.index;
  var d = {
    "title": "Delete Item",
    "text": "Are you sure you want to permanently delete this " + (ME.DATA.type ? ME.DATA.type.toLowerCase() : "item") + "?",
    "cb": function() { me.delete_item(i); }
  };
  document.body.ui.confirm(d);
};

me.set_item = function(d, i) {
  me.list[i] = d;
  me.rebuild();
};

me.add_item = function(d) {
  me.list.push(d);
  me.rebuild();
};

me.click_add = function() {
  var d = {
    "title": me.click_add_title,
    "value": me.default_value,
    "text": "Name",
    "subtext": me.click_add_prompt,
    "cb": function(val) {
      if (me.list.indexOf(val) == -1) {
        me.list.push(val);
        me.rebuild();
      }
      else document.body.ui.snackbarMsg("There is already an item with that name.");
    }
  };
  document.body.ui.prompt(d);
};
