// flowprims.js — the flowlang primitive catalog (66, flow3d-design Appendix A,
// from primitives.rs 0.3.29). Pure data for the palette's primitive picker.
//
// Terminal names: where Appendix A gives them in braces they are verbatim
// (sleep{millis}, set{object,key,value}, …); elsewhere they are inferred from
// arity ("most are (a[,b[,c]]) → a"). Inferred entries are a best-effort
// authoring default — terminals are editable in the op popover after creation,
// and the registry (Primitive::list()) can replace this table when a live
// catalog command exists. Every primitive emits on the single output `a`.

const P = (family, name, ins) => ({ family, name, ins, outs: ["a"] });

export const PRIMS = [
  // math (7) — all {a,b} → {a}
  ...["+", "-", "*", "/", "<", ">", "or"].map((n) => P("math", n, ["a", "b"])),
  // string (9)
  P("string", "split", ["a", "b"]),
  P("string", "trim", ["a"]),
  P("string", "ends_with", ["a", "b"]),
  P("string", "starts_with", ["a", "b"]),
  P("string", "string_left", ["a", "b"]),
  P("string", "string_right", ["a", "b"]),
  P("string", "substring", ["a", "b", "c"]),
  P("string", "length", ["a"]),
  P("string", "equals", ["a", "b"]),
  // object / array (13)
  P("object", "get", ["a", "b"]),
  P("object", "get_or_null", ["a", "b"]),
  P("object", "set", ["object", "key", "value"]),
  P("object", "remove", ["a", "b"]),
  P("object", "has", ["a", "b"]),
  P("object", "keys", ["a"]),
  P("object", "index_of", ["a", "b"]),
  P("object", "push", ["a", "b"]),
  P("object", "push_all", ["a", "b"]),
  P("object", "to_json", ["a"]),
  P("object", "object_from_json", ["a"]),
  P("object", "array_from_json", ["a"]),
  P("object", "is_object", ["a"]),
  // types (5)
  P("types", "to_int", ["a"]),
  P("types", "to_float", ["a"]),
  P("types", "to_boolean", ["a"]),
  P("types", "to_string", ["a"]),
  P("types", "is_string", ["a"]),
  // system (9)
  P("system", "time", []),
  P("system", "unique_session_id", []),
  P("system", "sleep", ["millis"]),
  P("system", "stdout", ["a"]),
  P("system", "system_call", ["command"]),
  P("system", "execute_command", ["lib", "ctl", "cmd", "params"]),
  P("system", "thread", ["lib", "ctl", "cmd", "params"]),
  P("system", "execute_id", ["lib", "id", "params"]),
  P("system", "thread_id", ["lib", "id", "params"]),
  // file (8)
  P("file", "file_read_all_string", ["a"]),
  P("file", "file_read_properties", ["a"]),
  P("file", "file_write_properties", ["a", "b"]),
  P("file", "file_exists", ["a"]),
  P("file", "file_visit", ["path", "recursive", "lib", "ctl", "cmd"]),
  P("file", "file_is_dir", ["a"]),
  P("file", "mime_type", ["a"]),
  P("file", "file_list", ["a"]),
  // data store (6)
  P("data", "data_read", ["lib", "id"]),
  P("data", "data_write", ["lib", "id", "data", "readers", "writers"]),
  P("data", "data_exists", ["lib", "id"]),
  P("data", "library_exists", ["lib"]),
  P("data", "library_new", ["lib", "readers", "writers"]),
  P("data", "data_root", []),
  // tcp (2)
  P("tcp", "tcp_listen", ["address", "port"]),
  P("tcp", "tcp_accept", ["listener"]),
  // http / ws (7)
  P("http", "http_listen", ["socket_address", "library", "control", "command"]),
  P("http", "cast_params", ["lib", "ctl", "cmd", "params"]),
  P("http", "http_hex_decode", ["a"]),
  P("http", "http_hex_encode", ["a"]),
  P("http", "http_websocket_open", ["stream_id", "key"]),
  P("http", "http_websocket_read", ["stream_id"]),
  P("http", "http_websocket_write", ["stream_id", "msg"]),
];

export const FAMILIES = [...new Set(PRIMS.map((p) => p.family))];

export function signature(prim) {
  return `(${prim.ins.join(", ")}) → a`;
}
