let user = get_user(&uuid).unwrap();
let con = get_best(user.clone());
if con.is_some() {
  let mut con = con.unwrap();
  return con.begin_stream();
}
-1
