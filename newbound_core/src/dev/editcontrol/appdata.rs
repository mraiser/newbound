use ndata::dataobject::DataObject;
use flowlang::datastore::*;
use flowlang::flowlang::file::read_properties::read_properties;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["data"] {
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
        let arg_0: DataObject = o.get_object("data");
        appdata(arg_0)
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

pub fn appdata(data: DataObject) -> DataObject {
let appid = data.get_string("name");

let store = DataStore::new();
let p = store.root.parent().unwrap().join("runtime").join(&appid).join("app.properties");
if p.exists() {
  return read_properties(p.into_os_string().into_string().unwrap());
}
else {
  let mut p = DataObject::new();
  let name = appid[0..1].to_uppercase()+&appid[1..];
  p.put_string("name", &name);
  p.put_string("id", &appid);
//  p.put_string("botclass", "com.newbound.robot.published."+name);
  p.put_string("img", "/app/asset/app/icon-square-app.png");
  p.put_string("libraries", &data.get_string("db")); // FIXME - should be lib not db
  p.put_string("price", "0");
  p.put_string("forsale", "true");
  p.put_string("desc", &("The ".to_string()+&name+" application"));
  p.put_string("index", "index.html");
  p.put_string("version", "0");
  p.put_string("ctldb", &data.get_string("db")); // FIXME - should be lib not db
  p.put_string("ctlid", &data.get_string("ctl"));
//  p.put_string("generate", "html,java");
  return p;
}
}
