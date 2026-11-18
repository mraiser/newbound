use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use crate::app::service::init::{path_is_safe, do_get};
use crate::app::app::asset::asset;

pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        test_path_traversal()
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

pub fn test_path_traversal() -> DataObject {
let mut checks = DataArray::new();
let mut all_ok = true;
let mut add = |name:&str, ok:bool, detail:String| {
  let mut c = DataObject::new();
  c.put_string("check", name);
  c.put_boolean("ok", ok);
  c.put_string("detail", &detail);
  checks.push_object(c);
  if !ok { all_ok = false; }
};

// 1. the shared lexical rule
for p in ["/", "/index.html", "/app/index.html", "/app/asset/app/css/a..b.css", "/a/.../b", "/a/..b/c", "/a/b../c"] {
  add("path_is_safe accepts", path_is_safe(p), p.to_string());
}
for p in ["/../Cargo.toml", "/..", "..", "/a/../b", "/a/b/..", "/a\\..\\b", "\\..\\x", "/a/\0/b"] {
  add("path_is_safe refuses", !path_is_safe(p), p.replace('\0', "<NUL>"));
}

// 2. do_get refuses traversal (raw and percent-encoded) before touching a file:
//    the static html route, both app html routes and the command route all sit behind it
for p in ["/../Cargo.toml", "/%2e%2e/Cargo.toml", "/%2E%2E/Cargo.toml", "/.%2e/Cargo.toml", "/../users/admin.properties",
          "/app/../../Cargo.toml", "/app/%2e%2e/%2e%2e/Cargo.toml", "/app/asset/app/../../../Cargo.toml",
          "/app/asset/%2e%2e/x", "/a/..%2fb", "/a%5c..%5cb"] {
  let mut req = DataObject::new();
  req.put_string("path", p);
  req.put_object("params", DataObject::new());
  let res = do_get(req, "".to_string());
  let code = if res.has("code") { res.get_int("code") } else { 200 };
  let ok = code == 400 && !res.has("file");
  add("do_get refuses", ok, format!("{} -> code {} file {}", p, code, res.has("file")));
}

// 3. app.asset refuses on its own (it is also reachable without do_get), and still serves a normal asset path
for p in ["/app/asset/../x", "/app/asset/app/../../../Cargo.toml", "/app/asset/%2e%2e/x", "/app/asset/app/%2e%2e/%2e%2e/x",
          "/app/asset//x", "/app/asset/app", "/app/asset/", "/app/asset"] {
  let r = asset(p.to_string());
  add("asset refuses", r.is_empty(), format!("{} -> '{}'", p, r));
}
let r = asset("/app/asset/app/css/x.css".to_string());
add("asset serves", r.ends_with("/app/_ASSETS/css/x.css") && path_is_safe(&r), r);

let n = checks.len() as i64;
let mut out = DataObject::new();
out.put_string("status", if all_ok { "ok" } else { "err" });
out.put_boolean("all_ok", all_ok);
out.put_int("count", n);
out.put_array("checks", checks);
out
}
