  let socket_address = "0.0.0.0:5770".to_string();
  START.call_once(|| { 
    let sock = UdpSocket::bind(socket_address).unwrap();
    sock.set_broadcast(true).unwrap();
    unsafe { DISCOVERYCON.set(RwLock::new(sock)); }
    println!("DISCOVERY UDP listening on port 5770");
  });

  thread::spawn(move || {
    do_listen();
  });
  
  thread::spawn(move || {
    do_send();
  });
  
  "OK".to_string()
}

static START: Once = Once::new();
static mut DISCOVERYCON:Storage<RwLock<UdpSocket>> = Storage::new();

fn do_send() {
  let mut system = DataStore::globals().get_object("system");
  let runtime = system.get_object("apps").get_object("app").get_object("runtime");
  let my_uuid = runtime.get_string("uuid");
  let buf = my_uuid.as_bytes();
  let broad = "255.255.255.255:5770";
  let beat = Duration::from_millis(10000);
  while system.get_bool("running") {
    let sock;
    unsafe { sock = DISCOVERYCON.get().write().unwrap().try_clone().unwrap(); }
    sock.send_to(&buf, &broad).unwrap();
    
    thread::sleep(beat);
  }
}

fn do_listen() {
  let mut system = DataStore::globals().get_object("system");
  let runtime = system.get_object("apps").get_object("app").get_object("runtime");
  let my_uuid = runtime.get_string("uuid");
  let mut buf = [0; 508]; 
  while system.get_bool("running") {
    let sock;
    unsafe { sock = DISCOVERYCON.get().write().unwrap().try_clone().unwrap(); }
    let (amt, src) = sock.recv_from(&mut buf).unwrap();
    let buf = &mut buf[..amt];
    let s = String::from_utf8(buf.to_vec()).unwrap();
    if s != my_uuid { println!("DISCOVERY {}", s); }
  }