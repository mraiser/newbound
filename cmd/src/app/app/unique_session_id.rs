use ndata::dataobject::*;

pub fn execute(_o: DataObject) -> DataObject {
let ax = unique_session_id();
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn unique_session_id() -> String {
flowlang::generated::flowlang::system::unique_session_id::unique_session_id()
}

