use flowlang::datastore::DataStore;
use flowlang::command::Command;
use flowlang::code::Code;
use flowlang::case::Case;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use std::panic;
use std::time::Instant;
use crate::app::service::init::format_result;
use crate::security::security::init::check_auth;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "cmd", "args", "nn_sessionid"] {
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
        let arg_2: String = o.get_string("cmd");
        let arg_3: DataObject = o.get_object("args");
        let arg_4: String = o.get_string("nn_sessionid");
        trace_flow(arg_0, arg_1, arg_2, arg_3, arg_4)
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

pub fn trace_flow(lib: String, ctl: String, cmd: String, args: DataObject, nn_sessionid: String) -> DataObject {
// The case path of ONE real run. flowlang's Code::execute walks the nextcase
// chain internally and reports only the final output, so this runs the chain
// ONE CASE AT A TIME through that same interpreter: each case executes with a
// tiny SENTINEL as its nextcase (a constant writing a marker key), so a `next`
// rule firing lands in the sentinel and returns with the marker instead of
// running case k+1 — then case k+1 runs on its own. Every op still executes
// exactly once, with the same args, in the interpreter's own order; outputs
// accumulate across cases exactly as Code::execute's shared `out` does. Auth,
// cast_params and format_result mirror app.app.exec, so `result` is the
// envelope a plain run of the command returns.
const MARK: &str = "__nb_trace_next__";
const SENTINEL: &str = r#"{"input":{},"output":{"__nb_trace_next__":{"mode":"out","type":"Boolean","x":0}},"cmds":[{"name":"true","type":"constant","ctype":"boolean","width":1,"pos":{"x":0,"y":0,"z":0},"in":{},"out":{"v":{"mode":"out","type":"Boolean","x":0}}}],"cons":[{"src":[0,"v"],"dest":[-2,"__nb_trace_next__"]}]}"#;

fn err_env(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}
fn panic_text(p: &Box<dyn std::any::Any + Send>) -> String {
    if let Some(s) = p.downcast_ref::<&str>() { s.to_string() }
    else if let Some(s) = p.downcast_ref::<String>() { s.clone() }
    else { "unknown panic".to_string() }
}

let store = DataStore::new();
let id = store.lookup_cmd_id(&lib, &ctl, &cmd);
if id.is_empty() { return err_env(&format!("Command {}:{}:{} not found", lib, ctl, cmd)); }
if !check_auth(&lib, &id, &nn_sessionid, false) { return err_env("UNAUTHORIZED"); }
let command = Command::new(&lib, &id);
if command.lang != "flow" {
    return err_env(&format!("'{}' is not a flow command (type is '{}')", cmd, command.lang));
}

let mut out = DataObject::new();
out.put_string("status", "ok");
let mut path = DataArray::new();

let mut args = args.clone();
args.put_string("nn_sessionid", &nn_sessionid);
let cast = { let c2 = &command; let a2 = args.clone(); panic::catch_unwind(panic::AssertUnwindSafe(move || c2.cast_params(a2))) };
if let Err(p) = cast {
    out.put_object("result", err_env(&format!("bad arguments: {}", panic_text(&p))));
    out.put_array("path", path);
    out.put_int("cases", 0);
    return out;
}

// the chain, root first
let mut chain: Vec<Case> = Vec::new();
let mut cur = Some(command.src());
while let Some(c) = cur {
    let next = c.nextcase.as_ref().map(|b| b.duplicate());
    chain.push(c);
    cur = next;
}
let n = chain.len();

let mut acc = DataObject::new();
let mut failure: Option<DataObject> = None;
let mut k = 0usize;
while k < n {
    let mut ck = chain[k].duplicate();
    ck.nextcase = Some(Box::new(Case::from_data(DataObject::from_string(SENTINEL))));
    // natural completion delivers EVERY wired return terminal (the case loop
    // ends only when all cons are done); a missing one means a terminate rule
    let wired_ret: Vec<String> = ck.cons.iter().filter(|w| w.dest.index == -2).map(|w| w.dest.name.clone()).collect();
    let a = args.clone();
    let t0 = Instant::now();
    let r = panic::catch_unwind(panic::AssertUnwindSafe(move || { let mut code = Code::new(ck); code.execute(a) }));
    let mut step = DataObject::new();
    step.put_int("case", k as i64);
    step.put_int("ms", t0.elapsed().as_millis() as i64);
    match r {
        Ok(Ok(o)) => {
            let jumped = o.has(MARK);
            for (key, v) in o.objects() { if key != MARK { acc.set_property(&key, v); } }
            if jumped {
                step.put_string("end", "next");
                path.push_object(step);
                if k + 1 >= n {
                    failure = Some(err_env(&format!("a next rule fired in case {} but the chain has no next case (I-4)", k + 1)));
                    break;
                }
                k += 1;
                continue;
            }
            let early = wired_ret.iter().any(|name| !o.has(name));
            step.put_string("end", if early { "terminate" } else { "done" });
            path.push_object(step);
            break;
        }
        Ok(Err(e)) => {
            step.put_string("end", "fail");
            path.push_object(step);
            failure = Some(err_env(&format!("the flow failed in case {} ({:?}: a fail rule fired)", k + 1, e)));
            break;
        }
        Err(p) => {
            let msg = panic_text(&p);
            step.put_string("end", "panic");
            step.put_string("msg", &msg);
            path.push_object(step);
            failure = Some(err_env(&format!("the flow panicked in case {}: {}", k + 1, msg)));
            break;
        }
    }
}

let result = match failure {
    Some(e) => e,
    None => {
        let cmd2 = Command::new(&lib, &id);
        let acc2 = acc.clone();
        match panic::catch_unwind(panic::AssertUnwindSafe(move || format_result(cmd2, acc2))) {
            Ok(x) => x,
            Err(p) => err_env(&format!("Server Error: {}", panic_text(&p))),
        }
    }
};
DataStore::gc();
out.put_object("result", result);
out.put_array("path", path);
out.put_int("cases", n as i64);
out
}
