let user = nn_session.get_object("user");
let nn_sessionid = nn_session.get_string("id");
let file = DataStore::new().root
            .parent().unwrap()
            .join("runtime")
            .join("securitybot")
            .join("session.properties");
let mut p;
if file.exists() {
  p = read_properties(file.to_owned().into_os_string().into_string().unwrap());
}
else {
  p = DataObject::new();
}
p.put_str(&nn_sessionid, &user.get_string("username"));

let mut file = File::create(file).unwrap();
for (k,v) in p.objects() {
  let s = format!("{}={}\n",k,Data::as_string(v));
  file.write_all(s.as_bytes()).unwrap();
}

format!("You are now logged in\", \"sessionid\": \"{}", nn_sessionid)