use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use ndata::dataarray::DataArray;
use flowlang::mcp::mcp::describe::describe;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl"] {
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
        let arg_0: String = o.get_string("lib");
        let arg_1: String = o.get_string("ctl");
        list_commands(arg_0, arg_1)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_array("a", ax);
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

pub fn list_commands(lib: String, ctl: String) -> DataArray {
let store = DataStore::new();
let real_id = crate::api::new().dev.editcontrol.lookup_id(lib.clone(), ctl.clone());
let ctlobj = store.get_data(&lib, &real_id).get_object("data");
let cmds = if ctlobj.has("cmd") { ctlobj.get_array("cmd") } else { DataArray::new() };

let mut out = DataArray::new();

for o in cmds.objects() {
  let mut o = o.object();
  //let id = o.get_string("id");
  //let cmdobj = store.get_data(&lib, &id).get_object("data");
  //out.push_object(cmdobj);
  
  
  let cmd = o.get_string("name");
  //out.push_string(&cmd);
  
  let toolname = format!("{}-{}-{}", &lib, &ctl, &cmd);
  let tool = describe(toolname);
  out.push_object(tool);
}

out
}
