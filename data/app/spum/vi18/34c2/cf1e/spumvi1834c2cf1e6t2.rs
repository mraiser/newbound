let mut a = DataArray::new();

let system = DataStore::globals().get_object("system");
let events = system.get_object("events");
if events.has(&app) { 
  let app = events.get_object(&app);
  for k in app.keys() {
    a.push_str(&k);
  }
}

a