use ndata::dataobject::DataObject;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: DataObject = o.get_object("nn_session");
    let ax = current_user(arg_0);
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn current_user(nn_session: DataObject) -> DataObject {
nn_session.get_object("user")
}
