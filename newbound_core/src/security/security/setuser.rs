use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use ndata::data::Data;
use crate::security::security::init::get_user;
use crate::security::security::init::set_user;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["id", "displayname", "password", "groups", "keepalive", "address", "port"] {
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
        let arg_0: String = o.get_string("id");
        let arg_1: String = o.get_string("displayname");
        let arg_2: String = o.get_string("password");
        let arg_3: DataArray = o.get_array("groups");
        let arg_4: Data = o.get_property("keepalive");
        let arg_5: Data = o.get_property("address");
        let arg_6: Data = o.get_property("port");
        setuser(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5, arg_6)
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

pub fn setuser(id: String, displayname: String, password: String, groups: DataArray, keepalive: Data, address: Data, port: Data) -> DataObject {
let x = get_user(&id);
let mut user;
if x.is_none() { user = DataObject::new(); }
else { user = x.unwrap(); }
user.put_string("displayname", &displayname);
user.put_string("password", &password);
user.put_array("groups", groups);
user.put_string("id", &id);
if Data::as_string(keepalive.clone()) == "true".to_string() { user.set_property("keepalive", keepalive); }
if Data::as_string(address.clone()) != "null".to_string() { user.set_property("address", address); }
if Data::as_string(port.clone()) != "null".to_string() { user.set_property("port", port.clone()); }
if Data::as_string(port.clone()) != "null".to_string() { user.set_property("p2pport", port); }
if !user.has("connections") { user.put_array("connections", DataArray::new()); }
set_user(&id, user.clone());

user
}
