use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("lib");
    let arg_1: i64 = o.get_int("version");
    let ax = lib_archive(arg_0, arg_1);
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn lib_archive(lib: String, version: i64) -> String {
let filename = lib + "_" + &version.to_string() + ".zip";
let file_path = DataStore::new().root.parent().unwrap().join("runtime").join("dev").join("libraries").join(&filename);

file_path.into_os_string().into_string().unwrap()
}
