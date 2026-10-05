// THE ANTI-GREP / ANTI-WALK SKILL. One entry point to locate ANYTHING in
// Newbound WITHOUT touching the filesystem broadly. Never walk a directory
// tree to find something the store already indexes; never shell out to
// grep/find over data/ (its mounts can be network-slow). Resolve instead.
//
// kind:
//   command  -> the command's source code (lib+ctl+cmd). source_kind
//               "generated" reads <lib>/src/<lib>/<ctl>/<cmd>.rs via a DIRECT
//               path probe; "body" passes read_command through.
//   control  -> the control record id (+ sharded disk path). lib+ctl.
//   asset    -> absolute path to a library asset file (direct probe). lib+name.
//   library  -> list of library ids in the instance.
//   path     -> resolve a 16+ char record id to its sharded data/ path (O(1)). id.
//   text     -> search CONTENT. query. Default: indexed command-source search
//               (dev.code.search_commands) scoped by lib/ctl (empty = all),
//               with a matching-line preview per hit. page=true: search the
//               LIVE browser page's visible text via one agent.browser.eval.
//
// Every route is indexed or O(1). Returns {status, ...} or {status:err, msg}.

fn ok() -> DataObject { let mut o = DataObject::new(); o.put_string("status", "ok"); o }
fn err(m: &str) -> DataObject { let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", m); o }

// Resolve a control NAME -> its store id via the control index (no scan).
fn ctl_id(lib: &str, name: &str) -> Result<String, String> {
    let arr = crate::api::new().dev.code.list_controls(lib.to_string());
    for i in 0..arr.len() {
        let c = arr.get_object(i);
        if c.get_string("name") == name {
            return Ok(c.get_string("id"));
        }
    }
    Err(format!("control '{}' not found in lib '{}'", name, lib))
}

// The store shards a record id as data/<lib>/[0..4]/[4..8]/[8..12]/[12..16]/<id>.
fn shard_path(lib: &str, id: &str) -> String {
    if id.len() >= 16 {
        format!("data/{}/{}/{}/{}/{}/{}", lib, &id[0..4], &id[4..8], &id[8..12], &id[12..16], id)
    } else {
        format!("data/{}/{}", lib, id)
    }
}

// Encode a Rust string as a JS string literal (for embedding `query` in eval JS).
fn js_string(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

let kind_l = kind.trim().to_lowercase();

match kind_l.as_str() {
    "library" => {
        let libs = crate::api::new().app.app.libs();
        let mut ids = DataArray::new();
        for i in 0..libs.len() {
            ids.push_string(&libs.get_object(i).get_string("id"));
        }
        let mut o = ok();
        o.put_array("libraries", ids);
        o
    }

    "path" => {
        if id.len() < 16 {
            return err("path kind needs a full 16+ char record id in `id`");
        }
        if lib.is_empty() {
            return err("path kind needs `lib`");
        }
        let p = shard_path(&lib, &id);
        let mut o = ok();
        o.put_string("id", &id);
        o.put_string("path", &p);
        o.put_boolean("exists", std::path::Path::new(&p).exists());
        o
    }

    "control" => {
        if lib.is_empty() || ctl.is_empty() {
            return err("control kind needs `lib` and `ctl`");
        }
        match ctl_id(&lib, &ctl) {
            Ok(cid) => {
                let mut o = ok();
                o.put_string("control", &ctl);
                o.put_string("id", &cid);
                let p = shard_path(&lib, &cid);
                o.put_string("path", &p);
                o.put_boolean("exists", std::path::Path::new(&p).exists());
                o
            }
            Err(e) => err(&e),
        }
    }

    "asset" => {
        if lib.is_empty() || name.is_empty() {
            return err("asset kind needs `lib` and `name` (relative asset path)");
        }
        let rel = format!("data/{}/_ASSETS/{}", lib, name.trim_start_matches('/'));
        let abs = std::env::current_dir()
            .map(|d| d.join(&rel).to_string_lossy().to_string())
            .unwrap_or(rel.clone());
        let exists = std::path::Path::new(&abs).exists();
        if !exists {
            let mut o = err(&format!("asset not found: {}", rel));
            o.put_string("path", &abs);
            return o;
        }
        let mut o = ok();
        o.put_string("lib", &lib);
        o.put_string("name", &name);
        o.put_string("path", &abs);
        o.put_boolean("exists", true);
        o
    }

    "command" => {
        if lib.is_empty() || ctl.is_empty() || cmd.is_empty() {
            return err("command kind needs `lib`, `ctl`, and `cmd`");
        }
        if source_kind == "body" {
            return crate::api::new().dev.code.read_command(lib, ctl, cmd);
        }
        let candidates = [
            format!("{0}/src/{0}/{1}/{2}.rs", lib, ctl, cmd),
            format!("{0}/src/{0}/{1}.rs", lib, cmd),
            format!("src/{0}/{1}/{2}.rs", lib, ctl, cmd),
            format!("src/{0}/{1}.rs", lib, cmd),
        ];
        let mut hit = String::new();
        for c in &candidates {
            if std::path::Path::new(c).exists() {
                hit = c.to_string();
                break;
            }
        }
        let mut o = ok();
        o.put_string("source_kind", "generated");
        if hit.is_empty() {
            o.put_boolean("found", false);
            let mut tried = DataArray::new();
            for c in &candidates {
                tried.push_string(c);
            }
            o.put_array("tried", tried);
            o.put_string(
                "note",
                "generated source not at a standard location; use source_kind=body (read_command) which is always indexed",
            );
        } else {
            o.put_boolean("found", true);
            o.put_string("path", &hit);
            match std::fs::read_to_string(&hit) {
                Ok(src) => o.put_string("source", &src),
                Err(e) => {
                    let mut eo = err(&format!("could not read {}: {}", hit, e));
                    eo.put_string("path", &hit);
                    return eo;
                }
            }
        }
        o
    }

    "text" => {
        if query.is_empty() {
            return err("text kind needs `query`");
        }
        if page {
            let jq = js_string(&query);
            let js = format!(
                "(function(){{var q={jq}.toLowerCase();var out=[];var all=document.querySelectorAll('*');for(var i=0;i<all.length;i++){{var e=all[i];if(e.children.length)continue;var t=(e.textContent||'').replace(/\\s+/g,' ').trim();if(t&&t.toLowerCase().indexOf(q)>=0){{var d=e.tagName.toLowerCase();var id=e.id?'#'+e.id:'';var cn=(''+(e.className||'')).trim().split(/\\s+/).filter(Boolean).slice(0,2).map(function(x){{return '.'+x;}}).join('');out.push({{el:d+id+cn,text:t.slice(0,200)}});}}}}return {{count:out.length,matches:out.slice(0,50)}};}})()",
                jq = jq
            );
            let r = crate::api::new().agent.browser.eval(js, 15000);
            let mut o = ok();
            o.put_string("mode", "page");
            o.put_object("result", r);
            return o;
        }
        let scope_lib = if lib.is_empty() { "*".to_string() } else { lib.clone() };
        let scope_ctl = if ctl.is_empty() { "*".to_string() } else { ctl.clone() };
        let hits = crate::api::new().dev.code.search_commands(scope_lib, scope_ctl, query.clone());
        let mut arr = DataArray::new();
        let n = hits.len();
        for i in 0..n.min(50) {
            let h = hits.get_object(i);
            let mut ho = DataObject::new();
            ho.put_string("lib", &h.get_string("lib"));
            ho.put_string("ctl", &h.get_string("ctl"));
            ho.put_string("cmd", &h.get_string("cmd"));
            let rc = crate::api::new().dev.code.read_command(
                h.get_string("lib"),
                h.get_string("ctl"),
                h.get_string("cmd"),
            );
            if let Ok(src) = rc.try_get_string("rs") {
                let ql = query.to_lowercase();
                let mut prev = String::new();
                let mut shown = 0;
                for line in src.lines() {
                    if line.to_lowercase().contains(&ql) {
                        prev.push_str(line.trim());
                        prev.push('\n');
                        shown += 1;
                        if shown >= 3 { break; }
                    }
                }
                ho.put_string("preview", &prev);
            }
            arr.push_object(ho);
        }
        let mut o = ok();
        o.put_string("mode", "commands");
        o.put_string("query", &query);
        o.put_int("count", n as i64);
        o.put_boolean("truncated", n > 50);
        o.put_array("matches", arr);
        o
    }

    other => err(&format!(
        "unknown kind '{}' (expected: command, control, asset, library, path, text)",
        other
    )),
}