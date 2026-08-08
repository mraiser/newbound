use ndata::dataobject::DataObject;
use ndata::data::Data;
use flowlang::datastore::DataStore;
use flowlang::flowlang::file::write_properties::write_properties;
use flowlang::appserver::init_globals;


pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["settings"] {
        if !o.has(p) {
            let mut e = DataObject::new();
            e.put_string("status", "err");
            e.put_string("msg", &format!("missing required parameter: {}", p));
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", e);
            return result_obj;
        }
    }
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        let arg_0: Data = o.get_property("settings");
        settings(arg_0)
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

pub fn settings(settings: Data) -> DataObject {
let system = DataStore::globals().get_object("system");
let mut o = system.get_object("config");
let mut b = false;
if !settings.clone().is_null(){
  for (k,v) in DataObject::from_string(&Data::as_string(settings)).objects() {
    o.set_property(&k,v);
    b = true;
  }
}
if b {
  let mut o = o.deep_copy();
  o.remove_property("socket_address");
  if o.has("security") {
    if o.get_boolean("security") { o.put_string("security", "on"); }
    else { o.put_string("security", "off"); }
  }
  write_properties("config.properties".to_string(), o.clone()); 
  init_globals();
}

o
}
