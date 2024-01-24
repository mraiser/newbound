let user = get_user(&uuid).unwrap();
let mut con = get_best(user.clone()).unwrap();
let v = data.get_data();
con.write_stream(stream_id, &v)