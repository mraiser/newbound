var me = this;
var ME = $('#' + me.UUID)[0];

me.ready = function() {
    document.body.api.ui.initNavbar(ME);
    me.children = [];
    me.state = 'cltab1';
    me.data = ME.DATA;
    if (!me.data) me.data = {};
    if (!me.data.three) me.data.three = { "controls": [] };
    if (!me.data.three.assets) me.data.three.assets = [];

    $(ME).find('.navbar-tab').click(function() {
        me.state = $(this).data("id");
        $(ME).find('.x3dctl-detail').css('display', 'none');
        $(ME).find('.x3dbehavior-editor').css('display', 'none');
    });

    buildViewer(buildControlList);
    buildBehaviors();

    $(ME).find('.add3dbehaviorbutton').click(function() {
        var nuname = prompt("Behavior Name");
        if (!nuname) return;
        var d = {
            id: guid(),
            name: nuname,
            body: "return 'ok';",
            params: []
        };
        if (!me.data.three.behaviors) me.data.three.behaviors = [];
        me.data.three.behaviors.push(d);
        buildBehaviors();
    });
};

me.activate = function() {
    setTimeout(function() {
        $(ME).find('.' + me.state + '-tab').click();
    }, 10);
};

me.deactivate = function() {};

$(ME).find('.add3dctlbutton').click(function() {
    var sels = $(ME).find('.add3dctlselect').find('select');
    var lib = $(sels[0]).val();
    var ctl = $(sels[1]).val();
    var name = $(sels[1]).find('option:selected').text();

    var d = {
        db: lib,
        id: ctl,
        name: name
    };

    me.data.three.controls.push(d);
    buildControlList();
    document.body.dirty();
});

function buildBehaviors() {
    var el = $(ME).find('.behaviorlist');
    var d = {
        list: me.data.three.behaviors,
        allowdelete: true,
        on_delete: function() {
            document.body.dirty();
        },
        click_edit: function(ctl, index) {
            var el = $(ME).find('.x3dbehavior-editor');
            var bwrap = el.find('.bwrap');
            var ta = $("<textarea class='x3dbehavior-src-js'></textarea>");
            bwrap.empty();
            bwrap.append(ta);
            ta.val(ctl.body);
            el.css('display', 'inline-block');

            var row = $($('.behaviorlist').find('li')[index]).find('span').find('span');

            var rebuildParams = function() {
                var newhtml = "function <input class='abn' type='text' value='" + ctl.name + "'>&nbsp;(";
                for (var i in ctl.params) {
                    var p = ctl.params[i];
                    if (i > 0) newhtml += ", ";
                    newhtml += "<button class='abp abdel' data-index='" + i + "'>x</button>";
                    newhtml += p.name;
                }
                newhtml += "<button class='abp abplus'>+</button>";
                newhtml += "){";
                $(ME).find('.x3db-name').html(newhtml);

                var abn = el.find('.abn');
                var plus = el.find('.abplus');
                var del = el.find('.abdel');
                plus.click(function() {
                    var q = prompt("Parameter Name");
                    if (!q) return;
                    var d = { name: q, type: "object" };
                    ctl.params.push(d);
                    rebuildParams();
                });
                del.click(function() {
                    var q = $(this).data('index');
                    ctl.params.splice(q, 1);
                    rebuildParams();
                });
                abn.change(ub).keyup(function() {
                    ctl.name = abn.val();
                    row.text(ctl.name);
                });
            };
            rebuildParams();

            var c = ta[0];
            var conf = {
                mode: 'javascript',
                theme: 'abcdef',
                lineWrapping: true,
                autofocus: false,
                viewportMargin: Infinity
            };
            if (c.cm) c.cm.toTextArea();
            c.cm = CodeMirror.fromTextArea(c, conf);

            var ub = function() {
                document.body.dirty();
                ctl.body = c.cm.getValue();
            };

            c.cm.on("change", ub);

            me.current_behavior = [ctl, index, row];
        }
    };
    var listEl = el[0];
    if(listEl.api) {
      listEl.api.rebuild(d);
    } else {
      installControl(listEl, 'app', 'list', null, d);
    }
}

function build3D() {
    for (var i in me.children) {
        var kid = me.children[i];
        me.scene.remove(kid.model);
        $('#' + kid.UUID).remove();
    }
    me.children = [];

    for (var i in me.data.three.controls) {
        var ctl = me.data.three.controls[i];
        loadControl(ctl);
    }
}

function buildControlList() {
    var el = $(ME).find('.3dctllist');
    var d = {
        list: me.data.three.controls,
        allowdelete: true,
        on_delete: function() {
            build3D();
            document.body.dirty();
        },
        click_edit: function(ctl, index) {
            var div = $('#' + ctl.uuid);
            if(div.length === 0) {
              console.error("Could not find control div for", ctl);
              return;
            }
            var api = div[0].api;
            var meta = div[0].meta;

            var puts = $(ME).find('.baseparams').find('input');
            $(puts[0]).val(ctl.name);

            var pos = api.model.position;
            $(puts[1]).val(pos.x);
            $(puts[2]).val(pos.y);
            $(puts[3]).val(pos.z);
            var rot = api.model.rotation;
            $(puts[4]).val(rot.x);
            $(puts[5]).val(rot.y);
            $(puts[6]).val(rot.z);
            var scale = api.model.scale;
            $(puts[7]).val(scale.x);
            $(puts[8]).val(scale.y);
            $(puts[9]).val(scale.z);

            $(ME).find('.x3dctl-detail').css('display', 'inline-block');
            $(ME).find('.x3dctl').css('display', 'none');
            div.css('display', 'inline-block');

            var row = $($('.3dctllist').find('li')[index]).find('span').find('span');
            me.current_kid = [ctl, api, meta, index, row];
            
            // Wire up input changes to update the model and rig
            puts.off('change keyup').on('change keyup', function() {
                document.body.dirty();
                
                var current_ctl = me.current_kid[0];
                var current_api = me.current_kid[1];
                var current_row = me.current_kid[4];
                
                // Update rig for live preview
                current_api.rig.pos_x   = parseFloat($(puts[1]).val()) || 0;
                current_api.rig.pos_y   = parseFloat($(puts[2]).val()) || 0;
                current_api.rig.pos_z   = parseFloat($(puts[3]).val()) || 0;
                current_api.rig.rot_x   = parseFloat($(puts[4]).val()) || 0;
                current_api.rig.rot_y   = parseFloat($(puts[5]).val()) || 0;
                current_api.rig.rot_z   = parseFloat($(puts[6]).val()) || 0;
                current_api.rig.scale_x = parseFloat($(puts[7]).val()) || 0;
                current_api.rig.scale_y = parseFloat($(puts[8]).val()) || 0;
                current_api.rig.scale_z = parseFloat($(puts[9]).val()) || 0;

                // Update backing data model for saving
                current_ctl.name     = $(puts[0]).val();
                current_ctl.pos.x    = $(puts[1]).val();
                current_ctl.pos.y    = $(puts[2]).val();
                current_ctl.pos.z    = $(puts[3]).val();
                current_ctl.rot.x    = $(puts[4]).val();
                current_ctl.rot.y    = $(puts[5]).val();
                current_ctl.rot.z    = $(puts[6]).val();
                current_ctl.scale.x  = $(puts[7]).val();
                current_ctl.scale.y  = $(puts[8]).val();
                current_ctl.scale.z  = $(puts[9]).val();
                
                // Update name in the list view
                current_row.text(current_ctl.name);
            });
        }
    };
    var listEl = el[0];
    if(listEl.api) {
      listEl.api.rebuild(d);
    } else {
      installControl(listEl, 'app', 'list', function(api) { build3D(); }, d);
    }
}

function buildViewer(cb) {
    let d = { "orbit": true };
    var el = $(ME).find('.viewer');
    installControl(el[0], "app", "scenegraph", function(api) {
        api.waitReady(function() {
            me.viewer = ME.viewer = api;
            me.scene = api.scene;
            me.camera = api.camera;
            me.renderer = api.renderer;
            if (cb) cb();
        });
    }, d);
}

function loadControl(ctl) {
    me.load(ctl, function(api) {
        var rig = api.rig;
        if (ctl.pos) {
            rig.pos_x = parseFloat(ctl.pos.x) || 0;
            rig.pos_y = parseFloat(ctl.pos.y) || 0;
            rig.pos_z = parseFloat(ctl.pos.z) || 0;
        } else { ctl.pos = { x: 0, y: 0, z: 0 }; }

        if (ctl.rot) {
            rig.rot_x = parseFloat(ctl.rot.x) || 0;
            rig.rot_y = parseFloat(ctl.rot.y) || 0;
            rig.rot_z = parseFloat(ctl.rot.z) || 0;
        } else { ctl.rot = { x: 0, y: 0, z: 0 }; }

        if (ctl.scale) {
            rig.scale_x = parseFloat(ctl.scale.x) || 1;
            rig.scale_y = parseFloat(ctl.scale.y) || 1;
            rig.scale_z = parseFloat(ctl.scale.z) || 1;
        } else { ctl.scale = { x: 1, y: 1, z: 1 }; }
    });
}

me.load = function(ctl, cb, parent) {
    if (!ctl.uuid) ctl.uuid = guid();
    var el = $('<div id="' + ctl.uuid + '" class="hideme x3dctl"/>');
    $(ME).find('.x3dctl-editor').append(el);
    var lib = ctl.db;
    var id = ctl.id;
    me.viewer.add(el[0], lib, id, cb, ctl, parent);
};
