let mut meta = DataStore::globals().get_object("system").get_object("apps").get_object("peer").get_object("runtime");
let mut b = false;
let ipaddr;
if meta.has("ip_address") { ipaddr = meta.get_string("ip_address"); }
else { ipaddr = "0.0.0.0".to_string(); meta.put_str("ip_address", &ipaddr); b=true; }
let port;
if meta.has("port") { port = Data::as_string(meta.get_property("port")).parse::<i64>().unwrap(); }
else { port = 0; meta.put_i64("port", port); b=true; }
if b {
  let file = DataStore::new().root
                .parent().unwrap()
                .join("runtime")
                .join("peer")
                .join("botd.properties");
  let _x = write_properties(file.into_os_string().into_string().unwrap(), meta.duplicate());
}

thread::spawn(move || {
  listen(ipaddr, port);
});
  
meta