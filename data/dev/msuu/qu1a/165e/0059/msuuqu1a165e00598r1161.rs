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