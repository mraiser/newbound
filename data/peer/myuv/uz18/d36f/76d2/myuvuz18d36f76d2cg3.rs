let user = get_user(&uuid).unwrap();
let mut con = get_best(user.clone()).unwrap();
con.begin_stream()