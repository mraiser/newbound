use ndata::dataobject::*;
use flowlang::datastore::*;
use flowlang::flowlang::file::read_properties::read_properties;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_object("data");
let ax = appdata(a0);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn appdata(data:DataObject) -> DataObject {
let appid = data.get_string("name");

let store = DataStore::new();
let p = store.root.parent().unwrap().join("runtime").join(&appid).join("app.properties");
if p.exists() {
  return read_properties(p.into_os_string().into_string().unwrap());
}
else {
  let mut p = DataObject::new();
  let name = appid[0..1].to_uppercase()+&appid[1..];
  p.put_str("name", &name);
  p.put_str("id", &appid);
//  p.put_str("botclass", "com.newbound.robot.published."+name);
  p.put_str("img", "/app/asset/app/icon-square-app.png");
  p.put_str("libraries", &data.get_string("db")); // FIXME - should be lib not db
  p.put_str("price", "0");
  p.put_str("forsale", "true");
  p.put_str("desc", &("The ".to_string()+&name+" application"));
  p.put_str("index", "index.html");
  p.put_str("version", "0");
  p.put_str("ctldb", &data.get_string("db")); // FIXME - should be lib not db
  p.put_str("ctlid", &data.get_string("ctl"));
//  p.put_str("generate", "html,java");
  return p;
}
}

