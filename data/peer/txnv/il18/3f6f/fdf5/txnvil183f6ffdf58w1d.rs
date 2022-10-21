let uuid = &nn_path[13..49];
let path = &nn_path[49..];
let user = get_user(uuid).unwrap();
let con = get_best(user).unwrap();
let sessionid = con.sessionid.to_owned();

let mut d = DataObject::new();
d.put_str("path", path);
d.put_str("sessionid", &sessionid);
d.put_object("params", nn_params);
d.put_object("headers", nn_headers);

let mut o = DataObject::new();
o.put_object("request", d);

let d = exec(uuid.to_string(), "peer".to_string(), "local".to_string(), o);

DataBytes::from_bytes(&d.to_string().as_bytes().to_vec())