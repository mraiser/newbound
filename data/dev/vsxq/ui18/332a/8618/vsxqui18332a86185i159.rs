let appid = data.get_string("name");

let store = DataStore::new();
let p = store.root.parent().unwrap().join("runtime").join(&appid).join("app.properties");
if p.exists() {
  return read_properties(p.into_os_string().into_string().unwrap());
}
else {
  let mut p = DataObject::new();
  let name = appid[0..1].to_uppercase()+&appid[1..];
  p.put_string("name", &name);
  p.put_string("id", &appid);
//  p.put_string("botclass", "com.newbound.robot.published."+name);
  p.put_string("img", "/app/asset/app/icon-square-app.png");
  p.put_string("libraries", &data.get_string("db")); // FIXME - should be lib not db
  p.put_string("price", "0");
  p.put_string("forsale", "true");
  p.put_string("desc", &("The ".to_string()+&name+" application"));
  p.put_string("index", "index.html");
  p.put_string("version", "0");
  p.put_string("ctldb", &data.get_string("db")); // FIXME - should be lib not db
  p.put_string("ctlid", &data.get_string("ctl"));
//  p.put_string("generate", "html,java");
  return p;
}