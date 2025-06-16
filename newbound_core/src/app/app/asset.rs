use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("nn_path");
    let ax = asset(arg_0);
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn asset(nn_path: String) -> String {
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
