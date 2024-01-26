let user = get_user(&uuid).unwrap();
let con = get_best(user.clone());
if con.is_none() { return false; }

let mut con = con.unwrap();
let v = data.get_data();
con.write_stream(stream_id, &v)