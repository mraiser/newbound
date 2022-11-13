use ndata::dataobject::*;
use std::fs::File;
use std::io::prelude::*;
use ndata::data::Data;
use flowlang::datastore::DataStore;
use flowlang::flowlang::file::read_properties::read_properties;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_object("nn_session");
let ax = remembersession(a0);
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn remembersession(nn_session:DataObject) -> String {
let user = nn_session.get_object("user");
let nn_sessionid = nn_session.get_string("id");
let file = DataStore::new().root
            .parent().unwrap()
            .join("runtime")
            .join("securitybot")
            .join("session.properties");
let mut p;
if file.exists() {
  p = read_properties(file.to_owned().into_os_string().into_string().unwrap());
}
else {
  p = DataObject::new();
}
p.put_str(&nn_sessionid, &user.get_string("username"));

let mut file = File::create(file).unwrap();
for (k,v) in p.objects() {
  let s = format!("{}={}\n",k,Data::as_string(v));
  file.write_all(s.as_bytes()).unwrap();
}

format!("You are now logged in\", \"sessionid\": \"{}", nn_sessionid)
}

