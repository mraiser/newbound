use ndata::dataobject::*;

pub fn execute(_o: DataObject) -> DataObject {
let ax = maintenance();
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn maintenance() -> DataObject {
println!("DOING STUFF!!");
DataObject::new()
}

