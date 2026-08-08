var me = this;
var ME = document.getElementById(me.UUID);

// bridge — kit v1's foundation (docs/kit.md): mounts ANY bench-dialect
// (ES-module) control inside a stock app's page, one document, no iframe.
//
//   installControl(el, 'app', 'bridge', function(bridge){
//     bridge.waitReady(function(){
//       var api = bridge.api;          // whatever the control's init returned
//     });
//   }, {control: 'sceneplayer', props: {lib: 'peer', ctl: 'peer'}});
//
// DATA: {control} — the control to mount, resolved by NAME through the
// union directory (it may live in app or the boot library); {props} —
// passed to the control's init verbatim (functions survive: installControl
// stores DATA by reference); optional {benchlib} — where the BOOT control
// lives (default 'dev', the Development app).
//
// Written in the stock dialect (no ES imports) precisely so stock mounts
// can run it. Since the module flag became first-class in api.js (the
// owner's design, 2026-07-30) the bridge carries NO bootstrap of its own:
// it installs the `app.modules` CLUSTER control — the same one the
// Development boot installs — and api.js registers every flagged module on
// the page. No manifest, no marker parsing, nothing to go stale. An
// already-booted module world on the page is reused (module identity is
// by URL string; installs are idempotent).

me.api = null;
me._readyCbs = [];
me._failed = null;

me.waitReady = function (cb) {
  if (me.api) cb();
  else me._readyCbs.push(cb);
};
me.dispose = function () {
  if (me.api && me.api.dispose) me.api.dispose();
  me.api = null;
};

function fail(msg) {
  me._failed = msg;
  var host = ME.querySelector(".nb-bridge-host");
  if (host) host.innerHTML = "<p style='padding:14px;font:12px monospace;color:#8a94a0'>" +
    "bridge failed to boot: " + String(msg).replace(/</g, "&lt;") + "</p>";
}

function readJSON(url, cb) {
  fetch(url).then(function (r) { return r.json(); }).then(function (j) {
    if (j.status !== "ok") throw new Error(j.msg || "app/read failed");
    cb(j);
  }).catch(function (e) { fail(e && e.message ? e.message : String(e)); });
}

me.ready = function () {
  var DATA = ME.DATA || {};
  var benchlib = DATA.benchlib || "dev";
  var host = ME.querySelector(".nb-bridge-host");
  if (!DATA.control) return fail("no {control} in DATA — nothing to mount");

  // Reuse an already-booted module world (a page mounting several bricks,
  // or a host that also runs the IDE).
  if (globalThis.__benchPlatform && globalThis.__benchPlatform.lib === benchlib) return mountNow();

  // declare the environment BEFORE installing (a module may read it at
  // import time — the loader's module-level ROOT); filled in place below
  var bench = globalThis.__benchPlatform = {
    lib: benchlib, moduleUrls: {}, controls: {},
    assetRoots: { "vendor/nb_three": "/app/asset/app/",
                  "vendor/nb_codemirror": "/app/asset/" + benchlib + "/" },
  };
  var d = document.createElement("div");
  d.hidden = true;
  ME.appendChild(d);
  installControl(d, "app", "modules", function () {
    // the union control directory over the libraries a brick mounts from
    var libs = ["app", benchlib];
    var dir = {};
    var left = libs.length;
    for (var i = 0; i < libs.length; i++) (function (l) {
      readJSON("/app/read?lib=" + encodeURIComponent(l) + "&id=controls", function (idx) {
        var local = {};
        var list = idx.data.list || [];
        for (var j = 0; j < list.length; j++) local[list[j].name] = list[j].id;
        dir[l] = local;
        if (--left === 0) withDirs();
      });
    })(libs[i]);

    function withDirs() {
      for (var li = 0; li < libs.length; li++) {
        for (var name in dir[libs[li]]) {
          if (!bench.controls[name]) bench.controls[name] = { lib: libs[li], id: dir[libs[li]][name] };
        }
      }
      for (var n in NB_MODULES) {
        if (NB_MODULES[n].url) bench.moduleUrls["assets/" + n + ".js"] = NB_MODULES[n].url;
      }
      mountNow();
    }
  });

  function mountNow() {
    requireModule("loader").then(function (loader) {
      return loader.mountControl(DATA.control, host, DATA.props || {});
    }).then(function (api) {
      me.api = api;
      var cbs = me._readyCbs;
      me._readyCbs = [];
      for (var i = 0; i < cbs.length; i++) cbs[i]();
    }).catch(function (e) { fail(e && e.message ? e.message : String(e)); });
  }
};
