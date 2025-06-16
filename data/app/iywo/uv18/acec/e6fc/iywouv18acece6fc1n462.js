var me = this;
var ME = $('#' + me.UUID)[0];

// --- Properties ---
me.children = [];
me.renderhooks = [];
me.scene = null;
me.camera = null;
me.renderer = null;
me.spotLight = null;
me.animationFrameId = null; // To hold the animation frame request
me.onWindowResize = null; // To hold the resize handler function

// --- Ready State Management ---
var readyPromise = new Promise(function(resolve) {
    me.resolveReady = resolve;
});

me.waitReady = function(cb) {
    readyPromise.then(function() {
        cb(me);
    });
};

// --- Lifecycle ---
me.destroy = function() {
    console.log("Destroying scenegraph instance: " + me.UUID);
    if (me.animationFrameId) {
        cancelAnimationFrame(me.animationFrameId);
    }
    if (me.onWindowResize) {
        window.removeEventListener('resize', me.onWindowResize);
    }
};

// --- Initialization ---
me.ready = function() {
    const scripts = [
        '../app/asset/app/threejs/three.min.js',
        '../app/asset/app/threejs/GLTFLoader.js',
        '../app/asset/app/threejs/FontLoader.js',
        '../app/asset/app/threejs/TextGeometry.js',
        '../app/asset/app/threejs/OrbitControls.js'
    ];
    scripts.reduce(function(p, script) {
        return p.then(function() {
            return $.getScript(script);
        });
    }, Promise.resolve())
    .then(loadFont)
    .then(initScene)
    .catch(function(err) {
        console.error("Failed to load scripts or initialize scene:", err);
    });
};

function loadFont() {
    return new Promise(function(resolve, reject) {
        var url = '../app/asset/app/threejs/helvetiker_regular.typeface.json';
        var loader = new THREE.FontLoader();
        loader.load(url, function(font) {
            document.body.font = font;
            resolve();
        }, undefined, reject);
    });
}

function initScene() {
    var el = $(ME).find('.matrixviewer');
    if (el.length === 0) {
        el = $(ME);
    }

    me.scene = new THREE.Scene();
    me.scene.viewer = me;

    var getDimensions = function() {
        var width = el.width();
        var height = el.height();
        if (height === 0) height = window.innerHeight - 96;
        if (width === 0) width = window.innerWidth;
        return { width: width, height: height };
    };

    var dims = getDimensions();
    me.camera = new THREE.PerspectiveCamera(75, dims.width / dims.height, 0.1, 1000);
    me.camera.position.z = 5;
    me.camera.lookAt(me.scene.position);
    me.scene.camera = me.camera;

    me.renderer = new THREE.WebGLRenderer({ alpha: true });
    me.renderer.setSize(dims.width, dims.height);
    me.renderer.setClearColor(0x000000, 0);
    el.append(me.renderer.domElement);
    me.scene.renderer = me.renderer;

    me.onWindowResize = function() {
        var newDims = getDimensions();
        if (newDims.width === 0 || newDims.height <= 0) return;
        if (me.camera) {
            me.camera.aspect = newDims.width / newDims.height;
            me.camera.updateProjectionMatrix();
        }
        if (me.renderer) {
            me.renderer.setSize(newDims.width, newDims.height);
        }
    }
    window.addEventListener('resize', me.onWindowResize, false);

    if (ME.DATA && ME.DATA.orbit) {
        new THREE.OrbitControls(me.camera, me.renderer.domElement);
    }

    me.scene.add(new THREE.HemisphereLight(0x888888, 0x888888));
    me.spotLight = new THREE.SpotLight(0xffffff);
    me.spotLight.castShadow = true;
    me.spotLight.position.set(20, 35, 40);
    me.scene.add(me.spotLight);
    me.scene.add(me.spotLight.target);

    $(me.renderer.domElement).on('click contextmenu', handleRaycastEvent); // contextmenu for right-click
    $(me.renderer.domElement).dblclick(handleRaycastEvent);

    if (ME.DATA && ME.DATA.ready) {
        ME.DATA.ready(me);
    }

    animate();
    me.resolveReady();
}

// --- Animation & Rendering ---
function animate() {
    me.animationFrameId = requestAnimationFrame(animate);
    render();
}

function render() {
    renderRecursive(me);
    me.renderhooks.forEach(function(hook) { hook(me); });
    me.renderer.render(me.scene, me.camera);
}

function applyRigging(target, rig) {
    if (!rig) return;
    if (typeof rig.pos_x !== 'undefined') target.position.x = rig.pos_x;
    if (typeof rig.pos_y !== 'undefined') target.position.y = rig.pos_y;
    if (typeof rig.pos_z !== 'undefined') target.position.z = rig.pos_z;
    if (typeof rig.rot_x !== 'undefined') target.rotation.x = rig.rot_x;
    if (typeof rig.rot_y !== 'undefined') target.rotation.y = rig.rot_y;
    if (typeof rig.rot_z !== 'undefined') target.rotation.z = rig.rot_z;
    if (typeof rig.scale_x !== 'undefined') target.scale.x = rig.scale_x;
    if (typeof rig.scale_y !== 'undefined') target.scale.y = rig.scale_y;
    if (typeof rig.scale_z !== 'undefined') target.scale.z = rig.scale_z;
}

function renderRecursive(container) {
    if (container.wait4animate) return;
    container.children.forEach(function(child) {
        if (child.rig) {
            applyRigging(child, child.rig);
        }
        if (child.api) {
            if (child.api.render) {
                child.api.render(child);
            }
            if (child.api.children) {
                renderRecursive(child.api);
            }
        }
    });
}

// --- Event Handling & Utilities ---
me.to3D = function(clientX, clientY) {
    var bounds = me.renderer.domElement.getBoundingClientRect();
    var mouse = new THREE.Vector2(
        ((clientX - bounds.left) / bounds.width) * 2 - 1,
        -((clientY - bounds.top) / bounds.height) * 2 + 1
    );
    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, me.camera);
    var plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    var intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);
    return intersectPoint;
};

function handleRaycastEvent(event) {
    var model = me.findEvent(event, event.type);
    if (model && typeof model[event.type] === 'function') {
        event.preventDefault();
        model[event.type](event);
    }
}

me.findEvent = function(event, type) {
    event.three = {};
    var bounds = me.renderer.domElement.getBoundingClientRect();
    var mouse = new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, me.camera);
    event.three.ray = raycaster.ray;
    var intersects = raycaster.intersectObjects(me.scene.children, true);
    if (intersects.length > 0) {
        event.three.intersect = intersects[0];
        var obj = event.three.intersect.object;
        while (obj) {
            if (obj.api && typeof obj.api[type] === 'function') {
                return obj.api;
            }
            obj = obj.parent;
        }
    }
    return null;
};

// --- Control Management ---
function addFunction(obj, name, params, body) {
    try {
        var func = new Function(params.join(','), body);
        obj[name] = func.bind(obj);
    } catch(e) {
        console.error("Error creating function '"+name+"':", e);
    }
}

function processBehaviors(api, behaviors) {
    if (!behaviors) return;
    behaviors.forEach(function(b) {
        var args = b.params.map(function(p) { return p.name; });
        if (b.lang === 'flow') {
            me.interpreter.addFunction(api, b.name, b);
        } else {
            addFunction(api, b.name, args, b.body);
        }
    });
}

function finalizeControlSetup(api, group, cb) {
    api.wait4animate = false;
    if (api.animate) {
        api.animate(group);
    }
    if (cb) {
        cb(api);
    }
}

function loadChildControls(parentApi, controls, parentEl, onAllChildrenLoaded) {
    if (!controls || controls.length === 0) {
        if (onAllChildrenLoaded) onAllChildrenLoaded();
        return;
    }
    var loadedCount = 0;
    var total = controls.length;
    controls.forEach(function(ctl) {
        var el2 = $('<div id="' + guid() + '"/>').appendTo(parentEl);
        var lib = ctl.lib || ctl.db;
        me.add(el2[0], lib, ctl.id, function(loadedChildApi) {
            loadedCount++;
            if (loadedCount === total) {
                if (onAllChildrenLoaded) onAllChildrenLoaded();
            }
        }, ctl, parentApi);
    });
}

me.add = function(el, lib, id, cb, data, parent) {
    if (typeof lib === 'undefined') {
        console.error("Control library not specified.");
        debugger;
        return;
    }
    installControl(el, lib, id, function(api) {
        var group = new THREE.Group();
        group.api = api;
        group.rig = {};
        group.scene = me.scene;
        api.model = group;
        api.viewer = me;
        api.owner = parent || me;
        api.data = data;
        api.wait4animate = true;
        if (!api.children) api.children = [];
        if (!api.rig) api.rig = group.rig;

        api.owner.children.push(group);
        if (parent) {
            parent.model.add(group);
        } else {
            me.scene.add(group);
        }

        var meta = $(el)[0].meta;
        var onChildrenReady = function() {
            if (meta && meta.three) {
                processBehaviors(api, meta.three.behaviors);
            }
            finalizeControlSetup(api, group, cb);
        };
        
        if (meta && meta.three && meta.three.controls && meta.three.controls.length > 0) {
            loadChildControls(api, meta.three.controls, el, onChildrenReady);
        } else {
            onChildrenReady();
        }
    }, data);
};

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
