use ndata::dataobject::*;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("nn_path");
let ax = remote(a0);
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn remote(nn_path:String) -> String {
nn_path
}

