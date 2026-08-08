use ndata::dataobject::DataObject;
use std::fs::File;
use std::io::prelude::*;
use ndata::data::Data;
use flowlang::datastore::DataStore;
use flowlang::flowlang::file::read_properties::read_properties;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["nn_session"] {
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
        let arg_0: DataObject = o.get_object("nn_session");
        remembersession(arg_0)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
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

pub fn remembersession(nn_session: DataObject) -> String {
let user = nn_session.get_object("user");
let nn_sessionid = nn_session.get_string("id");
let file = DataStore::new().root
            .parent().unwrap()
            .join("runtime")
            .join("securitybot")
            .join("session.properties");
let mut p;
if file.exists() {
  p = read_properties(file.to_owned().into_os_string().into_string().unwrap());
}
else {
  p = DataObject::new();
}
p.put_string(&nn_sessionid, &user.get_string("username"));

let mut file = File::create(file).unwrap();
for (k,v) in p.objects() {
  let s = format!("{}={}\n",k,Data::as_string(v));
  file.write_all(s.as_bytes()).unwrap();
}

format!("You are now logged in\", \"sessionid\": \"{}", nn_sessionid)
}
