use ndata::dataobject::*;

pub fn execute(_o: DataObject) -> DataObject {
let ax = init();
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn init() -> DataObject {
DataObject::new()
}

