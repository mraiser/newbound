use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["session", "list"] {
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
        let arg_0: String = o.get_string("session");
        let arg_1: DataArray = o.get_array("list");
        debug_set_breakpoints(arg_0, arg_1)
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

pub fn debug_set_breakpoints(session: String, list: DataArray) -> DataObject {
// Replace a debug session's breakpoints (flow step debugger P3). Each entry:
//  {kind: "op"|"wire"|"sync", index, frame?, case?}  - stops BEFORE that item is picked (op: before its eval/enter)
//  {kind: "case", case, frame?}                      - stops right after the case is entered (its seed)
//  {kind: "rule", rule?, op?, case?, frame?}         - stops after the eval that fired a rule, before its effect
// frame = the frame path [[op, iter], ...] ([] = the root); absent = any frame. Stall and error always stop.
// Breakpoints apply to over/out/run_to/continue (replayed and executed steps alike); a run never stops on the
// breakpoint it starts from.
fn err(msg: &str) -> DataObject { let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", msg); o }
let g = DataStore::globals();
if !(g.has("flowstep_debug") && g.get_property("flowstep_debug").is_object()) { return err(&format!("no debug session '{}'", session)); }
let all = g.get_object("flowstep_debug");
if !(all.has(&session) && all.get_property(&session).is_object()) { return err(&format!("no debug session '{}' (stopped or reaped?)", session)); }
let mut s = all.get_object(&session);
let mut bps = DataArray::new();
for (i, b) in list.objects().iter().enumerate() {
  if !b.is_object() { return err(&format!("breakpoint {} is not an object", i)); }
  let b = b.object();
  let k = if b.has("kind") && b.get_property("kind").is_string() { b.get_string("kind") } else { String::new() };
  let int = |key: &str| b.has(key) && b.get_property(key).is_int();
  let ok = match k.as_str() {
    "op" | "wire" | "sync" => int("index"),
    "case" => int("case"),
    "rule" => !b.has("rule") || b.get_property("rule").is_string(),
    _ => false,
  };
  if !ok { return err(&format!("breakpoint {} is not one of {{kind: op|wire|sync, index}}, {{kind: case, case}}, {{kind: rule, rule?}}: {}", i, b.to_string())); }
  if b.has("frame") && !b.get_property("frame").is_array() { return err(&format!("breakpoint {}: frame must be a path array [[op, iter], ...]", i)); }
  if b.has("cases") && !b.get_property("cases").is_array() { return err(&format!("breakpoint {}: cases must be an array of the frames' cases from the root down", i)); }
  bps.push_object(b.deep_copy());
}
s.put_array("bps", bps.clone());
s.put_int("touched", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0));
let mut o = DataObject::new();
o.put_string("status", "ok"); o.put_string("session", &session); o.put_array("breakpoints", bps);
o
}
