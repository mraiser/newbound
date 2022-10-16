use ndata::dataobject::*;

pub fn execute(_o: DataObject) -> DataObject {
let ax = lib_archive();
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn lib_archive() -> String {
"/home/mraiser/Desktop/rr.mp4".to_string()
}

