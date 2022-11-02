use ndata::dataobject::*;
use flowlang::datastore::DataStore;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("nn_path");
let ax = asset(a0);
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn asset(nn_path:String) -> String {
let root = DataStore::new().root;
let p = &nn_path[11..];
let x = p.find("/").unwrap();
let app = &p[..x];
let p = &p[x..];
let root = root.join(app);
let root = root.join("_ASSETS");
let root = root.into_os_string().into_string().unwrap();
let p = root + p;
p.to_string()
}

