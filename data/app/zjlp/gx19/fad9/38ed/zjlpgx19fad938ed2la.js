var me = this;
var ME = document.getElementById(me.UUID);

// player — the exemplar capability BRICK (kit v1, docs/kit.md): a scene
// facet playing inside any app's page with the platform's own idiom:
//
//   installControl(el, 'app', 'player', function(api){
//     api.waitReady(function(){
//       api.onstate = function(field, value){ ... };   // state changes out
//       api.setState('peers', [...]);                  // state in
//     });
//   }, {lib: 'peer', ctl: 'peer'});
//
// DATA: {lib, ctl} — whose scene facet to run; optional benchlib (where
// the BOOT control lives; default 'dev'), caption.
//
// Since kit v1 (R-3) the module-graph bootstrap lives in the generic
// `bridge` control (app lib) — this brick is the bridge + the sceneplayer
// control + a STABLE host-facing api (waitReady/setState/stateOf/
// onstate/dispose). peer.peer's call is unchanged; a brick keeps its api
// even when its plumbing moves.

me.api = null;
me.onstate = null;
me._readyCbs = [];

me.waitReady = function (cb) {
  if (me.api) cb();
  else me._readyCbs.push(cb);
};
me.setState = function (field, value) {
  if (me.api) me.api.setState(field, value);
};
me.stateOf = function () {
  return me.api ? me.api.stateOf() : {};
};
me.dispose = function () {
  if (me.api) me.api.dispose();
  me.api = null;
};

me.ready = function () {
  var DATA = ME.DATA || {};
  var host = ME.querySelector(".nb-player-host");
  installControl(host, "app", "bridge", function (bridge) {
    bridge.waitReady(function () {
      me.api = bridge.api;
      var cbs = me._readyCbs;
      me._readyCbs = [];
      for (var i = 0; i < cbs.length; i++) cbs[i]();
    });
  }, {
    control: "sceneplayer",
    benchlib: DATA.benchlib,
    props: {
      lib: DATA.lib, ctl: DATA.ctl, caption: DATA.caption,
      onState: function (prefix, field, value) {
        if (me.onstate) me.onstate(field, value, prefix);
      },
    },
  });
};
