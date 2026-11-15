use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use ndata::data::Data;
use ndata::dataarray::DataArray;

pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        available()
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
            result_obj
        }
        Err(err) => {
            let mut err_obj = DataObject::new();
            err_obj.put_string("status", "err");

            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic occurred".to_string()
            };

            err_obj.put_string("msg", &msg);
            // Wrapped in the same `a` envelope a successful return uses.
            // Unwrapped, callers that unpack the envelope (newbound's
            // format_result, for one) report an opaque 500 — "Not an object:
            // DString(\"err\")" — instead of this message.
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", err_obj);
            result_obj
        }
    }
}

pub fn available() -> DataObject {
// Plugins declare themselves: a control that is meant to be mounted as a
// plugin carries a `plugin` facet - JSON text giving its default
// registration {name?, target_lib, target_ctl, selector, desc?}, or an
// array of those when it has more than one home. The facet ships with the
// library, so any instance that installs the library can offer it. This
// command lists every declaration in the store and marks the ones this
// instance's runtime/dev/plugins.json already registers. Read-only.
fn field(o: &DataObject, k: &str) -> String {
    o.try_get_string(k).unwrap_or_default().trim().to_string()
}
// The house idiom: wrap the text so a well-formed non-object never panics.
fn parse_any(text: &str) -> Option<DataObject> {
    DataObject::try_from_string(&format!("{{\"a\":{}}}", text)).ok()
}

let store = DataStore::new();
let reg_path = store.root.parent().unwrap().join("runtime").join("dev").join("plugins.json");
let registry = match std::fs::read_to_string(&reg_path) {
    Ok(t) => match parse_any(&t) {
        Some(w) => w.try_get_object("a").unwrap_or_else(|_| DataObject::new()),
        None => DataObject::new(),
    },
    Err(_) => DataObject::new(),
};
let mut reg: Vec<(String, DataObject)> = Vec::new();
for (k, v) in registry.objects() {
    if let Data::DObject(_) = v { reg.push((k, v.object())); }
}

let mut lib_ids: Vec<String> = Vec::new();
for l in crate::api::new().app.app.libs().objects() {
    if let Data::DObject(_) = l {
        let id = field(&l.object(), "id");
        if !id.is_empty() { lib_ids.push(id); }
    }
}
lib_ids.sort();

let mut found: Vec<(String, DataObject)> = Vec::new();
let mut errors = DataArray::new();
for lib in &lib_ids {
    if !store.exists(lib, "controls") { continue; }
    let index = store.get_data(lib, "controls");
    let list = match index.try_get_object("data") {
        Ok(d) => match d.try_get_array("list") { Ok(a) => a, Err(_) => continue },
        Err(_) => continue,
    };
    for c in list.objects() {
        let c = match c { Data::DObject(_) => c.object(), _ => continue };
        let ctl = field(&c, "name");
        let id = field(&c, "id");
        if ctl.is_empty() || id.len() < 16 || !id.is_ascii() { continue; }
        // A facet is an attachment: a sibling file <id>.<facet> beside the
        // record. Probing it costs one stat per control and reads no record.
        let path = store.root.join(lib).join(&id[0..4]).join(&id[4..8])
            .join(&id[8..12]).join(&id[12..16]).join(format!("{}.plugin", id));
        if !path.is_file() { continue; }
        let text = match std::fs::read_to_string(&path) { Ok(t) => t, Err(_) => continue };
        if text.trim().is_empty() { continue; }
        let mut bad = |msg: &str| {
            let mut e = DataObject::new();
            e.put_string("lib", lib);
            e.put_string("ctl", &ctl);
            e.put_string("msg", msg);
            errors.push_object(e);
        };
        let wrapped = match parse_any(&text) {
            Some(w) => w,
            None => { bad("the plugin facet is not valid JSON"); continue; }
        };
        let mut decls: Vec<DataObject> = Vec::new();
        match wrapped.get_property("a") {
            Data::DObject(_) => decls.push(wrapped.get_object("a")),
            Data::DArray(_) => {
                for d in wrapped.get_array("a").objects() {
                    if let Data::DObject(_) = d { decls.push(d.object()); }
                }
            }
            _ => { bad("the plugin facet must be a JSON object or an array of objects"); continue; }
        }
        for d in decls {
            let target_lib = field(&d, "target_lib");
            let target_ctl = field(&d, "target_ctl");
            let selector = field(&d, "selector");
            if target_lib.is_empty() || target_ctl.is_empty() || selector.is_empty() {
                bad("a declaration needs target_lib, target_ctl and selector");
                continue;
            }
            let mut name = field(&d, "name");
            if name.is_empty() { name = format!("{}-{}", lib, ctl); }
            let mut o = DataObject::new();
            o.put_string("name", &name);
            o.put_string("plugin_lib", lib);
            o.put_string("plugin_ctl", &ctl);
            o.put_string("target_lib", &target_lib);
            o.put_string("target_ctl", &target_ctl);
            o.put_string("selector", &selector);
            o.put_string("desc", &field(&d, "desc"));
            // registered = some entry mounts this plugin at this exact place,
            // whatever it is called; name_taken = the declared name is in use
            // by a different registration (saving would replace that one).
            let mut registered_as = String::new();
            for (rn, r) in &reg {
                if field(r, "plugin_lib") == *lib && field(r, "plugin_ctl") == ctl
                    && field(r, "target_lib") == target_lib && field(r, "target_ctl") == target_ctl
                    && field(r, "selector") == selector {
                    registered_as = rn.clone();
                    break;
                }
            }
            o.put_boolean("registered", !registered_as.is_empty());
            o.put_boolean("name_taken", registered_as.is_empty() && reg.iter().any(|(rn, _)| *rn == name));
            o.put_string("registered_as", &registered_as);
            found.push((format!("{}.{}\u{0}{}", lib, ctl, name), o));
        }
    }
}
found.sort_by(|a, b| a.0.cmp(&b.0));
let mut plugins = DataArray::new();
for (_, o) in found { plugins.push_object(o); }

let mut out = DataObject::new();
out.put_array("plugins", plugins);
out.put_array("errors", errors);
out
}
