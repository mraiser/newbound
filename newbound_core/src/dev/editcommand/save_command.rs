use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use crate::app::app::read::read as app_read;
use crate::app::app::write::write as app_write;
use ndata::Data::DString;
use ndata::Data::DArray;
use ndata::Data::DNull;
use crate::app::app::unique_session_id::unique_session_id;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "cmd_id", "lang", "code", "imports", "returntype", "params", "desc", "groups", "readers", "nn_sessionid"] {
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
        let arg_1: String = o.get_string("cmd_id");
        let arg_2: String = o.get_string("lang");
        let arg_3: String = o.get_string("code");
        let arg_4: String = o.get_string("imports");
        let arg_5: String = o.get_string("returntype");
        let arg_6: DataArray = o.get_array("params");
        let arg_7: String = o.get_string("desc");
        let arg_8: String = o.get_string("groups");
        let arg_9: DataArray = o.get_array("readers");
        let arg_10: String = o.get_string("nn_sessionid");
        save_command(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5, arg_6, arg_7, arg_8, arg_9, arg_10)
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

pub fn save_command(lib: String, cmd_id: String, lang: String, code: String, imports: String, returntype: String, params: DataArray, desc: String, groups: String, readers: DataArray, nn_sessionid: String) -> String {
// 1. Fetch the command's primary metadata object
let mut cmd_meta = app_read(lib.clone(), cmd_id.clone(), nn_sessionid.clone()).get_object("data");

// Ensure the metadata knows its language type
cmd_meta.put_string("type", &lang);

// 2. Identify (or generate) the ID for the actual source code object
let source_id = if cmd_meta.has(&lang) {
  cmd_meta.get_string(&lang)
} else {
  let new_id = unique_session_id();
  cmd_meta.put_string(&lang, &new_id);
  new_id
};

// 3. Build the source code object (the 'cmddata' from the JS)
let mut source_obj = DataObject::new();
source_obj.put_string("type", &lang);

// Rust stores code under "rs", others use their name
let code_key = if lang == "rust" { "rs" } else { &lang };
source_obj.put_string(code_key, &code);

source_obj.put_string("import", &imports);
source_obj.put_string("returntype", &returntype);
source_obj.put_string("desc", &desc);
source_obj.put_array("params", params); // Move the params array in

let mut attachment_keys = DataArray::new();
attachment_keys.push_string(code_key);
source_obj.put_array("attachmentkeynames", attachment_keys);

if !groups.is_empty() {
  source_obj.put_string("groups", &groups);
}

// 4. Save the source code object
app_write(lib.clone(), DString(source_id), source_obj, DArray(readers.data_ref), DNull, nn_sessionid.clone());

// 5. Save the updated metadata object
app_write(lib.clone(), DString(cmd_id), cmd_meta, DArray(readers.data_ref), DNull, nn_sessionid);

"Command saved successfully".to_string()
}
