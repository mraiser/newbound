use ndata::dataobject::*;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_object("nn_session");
let ax = current_user(a0);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn current_user(nn_session:DataObject) -> DataObject {
nn_session.get_object("user")
}

