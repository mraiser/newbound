// Resolve the command and confirm it is a JavaScript command.
let store = DataStore::new();
let id = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| store.lookup_cmd_id(&lib, &ctl, &cmd))) {
    Ok(id) => id,
    Err(_) => {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Command {}:{}:{} not found", lib, ctl, cmd));
        return o;
    }
};
let lang = store.get_data(&lib, &id).get_object("data").get_string("type");
if !["javascript", "js", "typescript", "ts"].contains(&lang.as_str()) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("{}:{}:{} is a {} command, not a JavaScript command", lib, ctl, cmd, lang));
    return o;
}

// Regenerate its editor files from the store - <lib>/<ctl>/<cmd>.js with
// JSDoc types from the declared params, and flowlang.d.ts - as dev.compile
// does on every edit.
let _ = std::panic::catch_unwind(|| build(&lib, &ctl, &cmd, Path::new("")));

// Compile it in V8 and (if TypeScript's tsc is found) type-check it against
// flowlang.d.ts - never running the command.
#[cfg(feature = "javascript_runtime")]
{
    return flowlang::jscmd::check(&lib, &id);
}
#[cfg(not(feature = "javascript_runtime"))]
{
    let _ = id;
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "check_js needs a build with the JavaScript runtime: --features=serde_support,javascript_runtime");
    o
}