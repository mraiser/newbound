// The missing half of publishapp, and the deliberate act the deletion
// refusals point at ("unpublish first"). Removes the app descriptor
// (data/<lib>/_APPS/<app>) and the app's config.properties apps= entry
// (publishapp appends there itself, so this is symmetric), then refreshes
// the in-memory snapshot - the app stops being served immediately, no
// restart. remove_runtime additionally deletes runtime/<app>: right for an
// app whose runtime tree was publish-generated (the bench boot's was),
// WRONG for one with hand-authored platform files (dev's carries
// template.html and preview.html) - the caller decides, on purpose.
// The journal has no home for this (descriptors are not records); the
// canonical repo's git history is the record.

let _author = author;
let store = DataStore::new();
let approot = store.root.join(&lib).join("_APPS").join(&app);
if !approot.join("app.properties").exists() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("No published app '{}' in library '{}' (_APPS/{}/app.properties not found)", app, lib, app));
    return o;
}
let _x = std::fs::remove_dir_all(&approot);

let mut removed_runtime = false;
if remove_runtime {
    let rt = store.root.parent().unwrap().join("runtime").join(&app);
    if rt.exists() {
        let _x = std::fs::remove_dir_all(&rt);
        removed_runtime = true;
    }
}

// config.properties may be absent (a repo checkout ships only the
// example); the apps= edit is instance state, skipped when so.
let configfile = store.root.parent().unwrap().join("config.properties");
let mut config_edited = false;
if configfile.exists() {
    let path = configfile.to_owned().into_os_string().into_string().unwrap();
    let mut config = read_properties(path.to_owned());
    if config.has("apps") {
        let s = config.get_string("apps");
        let kept: Vec<&str> = s.split(",").filter(|x| *x != app.as_str()).collect();
        let joined = kept.join(",");
        if joined != s {
            config.put_string("apps", &joined);
            write_properties(path, config);
            config_edited = true;
        }
    }
}

flowlang::appserver::init_globals();

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("msg", &format!("App '{}' unpublished from library '{}'", app, lib));
o.put_boolean("removed_runtime", removed_runtime);
o.put_boolean("config_edited", config_edited);
o
