use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use ndata::dataarray::DataArray;
use ndata::data::Data;
use crate::security::security::init::{get_user, set_user, secure_id};
use crate::security::security::users::users;
use crate::peer::service::listen::{P2PConnection, get_best, to_hex};
use crate::peer::service::exec::exec;
use flowlang::blake2b::Blake2b;
use flowlang::flowlang::system::time::time;
use std::thread;
use std::sync::mpsc;
use std::time::{Duration, Instant};

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["uuid", "action", "publickey"] {
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
        let arg_0: String = o.get_string("uuid");
        let arg_1: String = o.get_string("action");
        let arg_2: String = o.get_string("publickey");
        peer_key(arg_0, arg_1, arg_2)
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

pub fn peer_key(uuid: String, action: String, publickey: String) -> DataObject {
  let mut out = DataObject::new();
  let action = action.trim().to_lowercase();
  let uuid = uuid.trim().to_string();
  let key = publickey.trim().to_uppercase();
  let mut user = match get_user(&uuid) {
    Some(u) if uuid.len() == 36 => u,
    _ => return key_err("There is no peer record with that ID."),
  };
  let had = if user.has("publickey") { user.get_string("publickey") } else { String::new() };

  if action == "set" {
    if !valid_key(&key) { return key_err("A public key is 64 hex digits."); }
    let mine = DataStore::globals().get_object("system").get_object("apps").get_object("app").get_object("runtime").get_string("publickey");
    if mine.eq_ignore_ascii_case(&key) { return key_err("That is this device's own public key."); }
    user.put_string("publickey", &key);
    stamp(&mut user, "offline", "");
    set_user(&uuid, user.clone());
    if had != "" && !had.eq_ignore_ascii_case(&key) { out.put_int("disconnected", drop_connections(&uuid)); }
  }
  else if action == "verify" {
    if had == "" { return key_err("This peer has no key on record yet."); }
    if key != "" && !had.eq_ignore_ascii_case(&key) { return key_err("The key on record has changed. Check it again."); }
    stamp(&mut user, "verified", "");
    set_user(&uuid, user.clone());
  }
  else if action == "forget" {
    for k in ["publickey", "key_source", "key_time", "key_voucher", "key_conflict"] {
      if user.has(k) { user.remove_property(k); }
    }
    set_user(&uuid, user.clone());
    out.put_int("disconnected", drop_connections(&uuid));
  }
  else if action == "lookup" {
    if had == "" { out.put_object("lookup", vouch_lookup(&uuid)); }
  }
  else { return key_err("Unknown action. Use set, verify, forget or lookup."); }

  out.put_string("status", "ok");
  out.put_string("id", &uuid);
  if user.has("publickey") { out.put_string("publickey", &user.get_string("publickey")); }
  if user.has("key_source") { out.put_string("key_source", &user.get_string("key_source")); }
  if user.has("key_voucher") { out.put_string("key_voucher", &user.get_string("key_voucher")); }
  out
}

fn key_err(msg: &str) -> DataObject {
  let mut o = DataObject::new();
  o.put_string("status", "err");
  o.put_string("msg", msg);
  o
}

pub fn valid_key(k: &str) -> bool {
  k.len() == 64 && k.bytes().all(|b| b.is_ascii_hexdigit())
}

// Records HOW a peer's public key was obtained: offline (typed in by the
// user), vouched (reported by an already trusted peer), tofu (taken from the
// peer itself on first contact, after the handshake proof) or verified (the
// user checked it). A fresh stamp clears any conflict flag.
pub fn stamp(user: &mut DataObject, source: &str, voucher: &str) {
  user.put_string("key_source", source);
  user.put_int("key_time", time());
  if voucher != "" { user.put_string("key_voucher", voucher); }
  else if user.has("key_voucher") { user.remove_property("key_voucher"); }
  if user.has("key_conflict") { user.remove_property("key_conflict"); }
}

pub fn drop_connections(uuid: &str) -> i64 {
  let mut n = 0;
  for id in P2PConnection::list() {
    if let Some(con) = P2PConnection::try_get(id) {
      if con.uuid == uuid { let _ = con.shutdown(&con.uuid, id); n += 1; }
    }
  }
  n
}

fn group_list(u: &DataObject) -> Vec<String> {
  let mut v = Vec::new();
  if u.has("groups") && u.get_property("groups").is_array() {
    for x in u.get_array("groups").objects() {
      let s = Data::as_string(x);
      if s != "" { v.push(s); }
    }
  }
  v
}

// A peer may vouch for another peer's key only when a fake key could not buy
// it anything it does not already have: it is an admin here, or it already
// holds every group the vouched-for record carries.
pub fn can_vouch(voucher: &DataObject, target: &DataObject) -> bool {
  let vg = group_list(voucher);
  if vg.iter().any(|g| g == "admin") { return true; }
  group_list(target).iter().all(|g| g == "anonymous" || vg.contains(g))
}

// Applies the `keys` map ({uuid: publickey}) from a connected peer's
// peer.info reply. A keyless local record gets the key pinned as "vouched";
// a record whose first-contact or vouched key DIFFERS is flagged with
// key_conflict (never overwritten). Offline and verified keys are left alone.
pub fn apply_vouch(voucher_id: &str, keys: &DataObject) -> DataObject {
  let mut pinned = DataArray::new();
  let mut conflicts = DataArray::new();
  let mut out = DataObject::new();
  out.put_array("pinned", pinned.clone());
  out.put_array("conflicts", conflicts.clone());
  let voucher = match get_user(voucher_id) { Some(v) => v, None => return out };
  let my_uuid = DataStore::globals().get_object("system").get_object("apps").get_object("app").get_object("runtime").get_string("uuid");
  for (tid, k) in keys.objects() {
    if tid == voucher_id || tid == my_uuid || !k.is_string() { continue; }
    let k = k.string().to_uppercase();
    if !valid_key(&k) { continue; }
    let mut t = match get_user(&tid) { Some(t) => t, None => continue };
    if !can_vouch(&voucher, &t) { continue; }
    if !t.has("publickey") {
      t.put_string("publickey", &k);
      stamp(&mut t, "vouched", voucher_id);
      set_user(&tid, t.clone());
      println!("P2P key for {} vouched by {}", &tid, voucher_id);
      pinned.push_string(&tid);
    }
    else if !t.get_string("publickey").eq_ignore_ascii_case(&k) {
      let src = if t.has("key_source") { t.get_string("key_source") } else { String::new() };
      if src != "offline" && src != "verified" {
        let note = voucher_id.to_string() + " " + &k;
        if !t.has("key_conflict") || t.get_string("key_conflict") != note {
          t.put_string("key_conflict", &note);
          set_user(&tid, t.clone());
          println!("P2P KEY CONFLICT for {}: {} reports a different key", &tid, voucher_id);
        }
        conflicts.push_string(&tid);
      }
    }
  }
  out
}

// Asks every connected peer that may vouch for `target` for its key (one
// peer.info call each, in parallel, 6 s in total) and applies the answers.
pub fn vouch_lookup(target: &str) -> DataObject {
  let mut out = DataObject::new();
  let t = match get_user(target) { Some(t) => t, None => return out };
  let salt = secure_id();
  let mut hasher = Blake2b::new(10);
  hasher.update(salt.as_bytes());
  hasher.update(target.as_bytes());
  let res = hasher.finalize();
  let hash = to_hex(&res);
  let (tx, rx) = mpsc::channel::<(String, DataObject)>();
  let mut asked = 0;
  for (vid, v) in users().objects() {
    if vid.len() != 36 || vid == target || !v.is_object() { continue; }
    let v = v.object();
    if !can_vouch(&v, &t) || get_best(v.clone()).is_none() { continue; }
    asked += 1;
    let tx = tx.clone();
    let salt = salt.clone();
    let hash = hash.clone();
    thread::spawn(move || {
      let mut d = DataObject::new();
      let mut a = DataArray::new();
      a.push_string(&hash);
      d.put_array("uuid", a);
      d.put_string("salt", &salt);
      let o = exec(vid.clone(), "peer".to_string(), "info".to_string(), d);
      let _ = tx.send((vid, o));
    });
  }
  drop(tx);
  let deadline = Instant::now() + Duration::from_millis(6000);
  let mut answered = 0;
  let mut conflict = false;
  while answered < asked {
    let left = deadline.saturating_duration_since(Instant::now());
    match rx.recv_timeout(left) {
      Ok((vid, o)) => {
        answered += 1;
        if o.has("status") && o.get_string("status") == "ok" && o.has("data") && o.get_property("data").is_object() {
          let data = o.get_object("data");
          if data.has("keys") && data.get_property("keys").is_object() {
            let r = apply_vouch(&vid, &data.get_object("keys"));
            if r.get_array("conflicts").len() > 0 { conflict = true; }
          }
        }
      },
      Err(_) => break,
    }
  }
  out.put_int("asked", asked);
  out.put_int("answered", answered);
  out.put_boolean("found", t.has("publickey"));
  out.put_boolean("conflict", conflict);
  out
}
