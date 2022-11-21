use ndata::dataobject::*;
use flowlang::datastore::DataStore;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("lib");
let a1 = o.get_int("version");
let ax = lib_archive(a0, a1);
let mut o = DataObject::new();
o.put_string("a", &ax);
o
}

pub fn lib_archive(lib:String, version:i64) -> String {
let filename = lib + "_" + &version.to_string() + ".zip";
let file_path = DataStore::new().root.parent().unwrap().join("runtime").join("dev").join("libraries").join(&filename);

file_path.into_os_string().into_string().unwrap()
}

