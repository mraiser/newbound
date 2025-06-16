use ndata::dataobject::DataObject;

pub fn execute(_: DataObject) -> DataObject {
    let ax = unique_session_id();
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn unique_session_id() -> String {
flowlang::flowlang::system::unique_session_id::unique_session_id()
}
