use ndata::dataobject::*;
use std::thread;
use std::panic;
use std::fs;
use flowlang::datastore::*;
use std::net::TcpListener;
use flowlang::appserver::save_config;
use flowlang::appserver::fire_event;
use ndata::data::Data;
use flowlang::flowlang::system::unique_session_id::unique_session_id;
use flowlang::flowlang::system::time::time;
use ndata::dataarray::DataArray;
use flowlang::flowlang::http::hex_decode::hex_decode;
use std::net::TcpStream;
use std::sync::Once;
use state::Storage;
use std::sync::RwLock;
use ndata::heap::Heap;
use flowlang::flowlang::file::mime_type::mime_type;
use flowlang::rfc2822date::RFC2822Date;
use std::path::Path;
use std::fs::metadata;
use flowlang::sha1::SHA1;
use flowlang::base64::Base64;
use flowlang::appserver::lookup_command_id;
use flowlang::command::Command;
use flowlang::appserver::add_event_hook;
use std::io::Write;
use std::io::Read;
use core::time::Duration;
use crate::peer::service::exec::exec;
use crate::security::security::init::check_security;

#[cfg(not(feature = "webview"))]
use flowlang::flowlang::system::system_call::system_call;
#[cfg(not(feature = "webview"))]
use crate::security::security::init::get_user;
#[cfg(not(feature = "webview"))]
use crate::security::security::init::log_in;

pub fn execute(_o: DataObject) -> DataObject {
let ax = init();
let mut o = DataObject::new();
o.put_string("a", &ax);
o
}

pub fn init() -> String {
  START.call_once(|| { WEBSOCKHEAP.set(RwLock::new(Heap::new())); });  

  let beat = Duration::from_millis(10);
  let system = DataStore::globals().get_object("system");
  while !system.has("security_ready") { thread::sleep(beat); }

  // Start HTTP
  thread::spawn(http_listen);

  let hook = |app: &str, event: &str, data: DataObject| {
    let de = Data::DString(event.to_string());
    let mut sockheap = WEBSOCKHEAP.get().write().unwrap();
    for sockref in sockheap.keys(){
      let sock = sockheap.get(sockref);
      let subs = sock.sub.clone();
      if subs.has(&app){
        let app = subs.get_array(&app);
        if app.index_of(de.clone()) != -1 {
          let stream = sock.stream.try_clone().unwrap();
          // FIXME - Remove the dead ones
          websock_message(stream, data.to_string());
        }
      }
    }
  };
  add_event_hook(hook);

  "OK".to_string()
}

#[derive(Debug)]
pub struct WebsockConnection {
  pub stream: TcpStream,
  pub sub: DataObject,
}

static START: Once = Once::new();
pub static WEBSOCKHEAP:Storage<RwLock<Heap<WebsockConnection>>> = Storage::new();

pub fn http_listen() {
  let mut system = DataStore::globals().get_object("system");
  let mut config = system.get_object("config");
  let ipaddr = config.get_string("http_address");
  let port = config.get_string("http_port");
  let socket_address = ipaddr+":"+&port;

  let b = port == "0";
  let listener = TcpListener::bind(socket_address).unwrap();
  let port = listener.local_addr().unwrap().port();
  println!("HTTP TCP listening on port {}", port);

  config.put_int("http_port", port as i64);
  if b { save_config(config.clone()); }
  
  system.put_boolean("http_ready", true);
  
  #[cfg(not(feature = "webview"))]
  if !config.has("headless") || !(Data::as_string(config.get_property("headless")) == "true".to_string()) {
    let user = get_user("admin");
    if user.is_some(){
      thread::spawn(move || {
        let user = user.unwrap();
        
        // FIXME - Make session creation a function
        let session_id = unique_session_id();
        let mut session = DataObject::new();
        session.put_int("count", 0);
        session.put_string("id", &session_id);
        session.put_string("username", "admin");
        session.put_object("user", user.clone());
        let sessiontimeoutmillis = system.get_object("config").get_int("sessiontimeoutmillis");
        let expire = time() + sessiontimeoutmillis;
        session.put_int("expire", expire);
        let mut sessions = system.get_object("sessions");
        sessions.put_object(&session_id, session.clone());
        
        let pass = user.get_string("password");
        if log_in(&session_id, "admin", &pass){
          let default_app = system.get_string("default_app");
                
          let mut s = "http://localhost:".to_string();
          s += &port.to_string();
          s += "/";
          s += &default_app;
          s += "/index.html?sessionid=";
          s += &session_id;
          
          let mut a = DataArray::new();
          a.push_string("open");
          a.push_string(&s);
          system_call(a);
        }
      });
    }
  }
    
  let max_keep_alive = Duration::from_millis(3000);
  for stream in listener.incoming() {
    let mut stream = stream.unwrap();
    let _x = stream.set_read_timeout(Some(max_keep_alive));
    thread::spawn(move || {
      let remote_addr = stream.peer_addr().unwrap();
//      let mut keepalivecount = 0;
      loop {
//        if keepalivecount > 0 { println!("keepalivecount {}", keepalivecount); }
        let mut line = read_line(&mut stream);
        let count = line.len();
//        println!("line len {}", count);
        if count == 0 { break; }
        line = (&line[0..count-2]).to_string();
        let count = line.find(" ").unwrap();
        let method = (&line[0..count]).to_string();
        line = (&line[count+1..]).to_string();
        let count = line.find(" ");
        if count.is_none() { 
          println!("HTTP TCP unexpected request protocol: {}", line); 
          return; 
        }

        let count = count.unwrap();
        let protocol = (&line[count+1..]).to_string();
        let path = (&line[0..count]).to_string();

        let mut headers = DataObject::new();
        let mut last = "".to_string();
        loop {
          let line = read_line(&mut stream);
          let mut count = line.len();
          if count == 2 {
            break;
          }
          if (&line[0..1]).to_string() != " ".to_string(){
            count = line.find(":").unwrap();
            let mut key = (&line[0..count]).to_string();
            key = key.to_uppercase();
            let mut val = (&line[count+1..]).to_string();
            val = val.trim().to_string();
            if !headers.has(&key) {
              headers.put_string(&key, &val);
            }
            else {
              let d = headers.get_property(&key);
              if d.is_array() {
                d.array().push_string(&val);
              }
              else {
                let old = d.string();
                let mut v = DataArray::new();
                v.push_string(&old);
                v.push_string(&val);
                headers.put_array(&key, v);
              }
            }
            last = key;
          }
          else {
            let d = headers.get_property(&last);
            if d.is_array(){
              let mut v = d.array();
              let n = v.len() - 1;
              let mut old = v.get_string(n);
              v.remove_property(n);
              old = old + "\r\n" + line.trim_end();
              v.push_string(&old);
            }
            else {
              let mut old = d.string();
              old = old + "\r\n" + line.trim_end();
              headers.put_string(&last, &old);
            }
          }
        }

        let mut querystring = "".to_string();
        let mut params = DataObject::new();

        if method == "POST" {
          // extractPOSTParams
          let clstr = headers.get_string("CONTENT-LENGTH");
          let ctstr = headers.get_string("CONTENT-TYPE");
          let mut max = clstr.parse::<i64>().unwrap();

          let s = ctstr.to_lowercase();
          if s.starts_with("multipart/") {
            // MULTIPART

            panic!("No MIME MULTIPART support yet");


          }
          else {
            while max > 0 {
              let mut b = false;
              let mut buf = vec![];
              let n = read_until(&mut stream, b'=', &mut buf);
              max -= n as i64;
              let mut key = std::str::from_utf8(&buf).unwrap().to_string();
              if key.ends_with("=") {
                key = (&key[..n-1]).to_string();
              }

              buf = vec![];
              let n = read_until(&mut stream, b'&', &mut buf);
              max -= n as i64;
              let mut value = std::str::from_utf8(&buf).unwrap().to_string();
              if value.ends_with("&") {
                value = (&value[..n-1]).to_string();
              }
              else { b = true; }

              key = key.replace("+"," ");
              value = value.replace("+"," ");
              key = hex_decode(key);
              value = hex_decode(value);

              params.put_string(&key, &value);

              if b { break; }
            }
          }
        }

        let cmd:String;
        if path.contains("?"){
          let i = path.find("?").unwrap();
          cmd = path[0..i].to_string();
          querystring = path[i+1..].to_string();
          let mut oneline = querystring.to_owned();
          let mut oneparam:String;
          while oneline.len() > 0 {
            if oneline.contains("&")  {
              let i = oneline.find("&").unwrap();
              oneparam = oneline[0..i].to_string();
              oneline = oneline[i+1..].to_string();
            }
            else {
              oneparam = oneline;
              oneline = "".to_string();
            }

            if oneparam.contains("=") {
              let i = oneparam.find("=").unwrap();
              let key = hex_decode(oneparam[0..i].to_string());
              let value = hex_decode(oneparam[i+1..].to_string());
              params.put_string(&key, &value);
            }
          }
        }
        else {
          cmd = path;
        }
        let loc = remote_addr.to_string();
        headers.put_string("nn-userlocation", &loc);
        let mut request = DataObject::new();

        // FIXME - Is this necessary?
        if headers.has("ACCEPT-LANGUAGE"){ 
          let lang = headers.get_string("ACCEPT-LANGUAGE");
          request.put_string("language", &lang);
        }
        else {
          request.put_string("language", "*");
        }

        // FIXME - Is this necessary?
        if headers.has("HOST"){ 
          let h = headers.get_string("HOST");
          request.put_string("host", &h);
        }

        // FIXME - Is this necessary?
        if headers.has("REFERER"){ 
          let h = headers.get_string("REFERER");
          request.put_string("referer", &h);
        }

        request.put_string("protocol", &protocol);
        request.put_string("path", &cmd);
        request.put_string("loc", &loc);
        request.put_string("method", &method);
        request.put_string("querystring", &querystring);
        request.put_object("headers", headers.clone());
        request.put_object("params", params);

        let now = time();
        request.put_int("timestamp", now);

        fire_event("app", "HTTP_BEGIN", request.clone());

        // FIXME - implement or remove
        if headers.has("TRANSFER-ENCODING"){
          let trenc = headers.get_string("TRANSFER-ENCODING");
          if trenc.to_uppercase() == "CHUNKED" {
            // CHUNKED
          }
        }


        let mut ka;
        if headers.has("CONNECTION") { ka = headers.get_string("CONNECTION"); }
        else { ka = "close".to_string(); }

        // FIXME - origin is never used, impliment CORS
        //      let mut origin = "null".to_string();
        //      if headers.has("ORIGIN") { origin = headers.get_string("ORIGIN"); }

        let mut response = DataObject::new();
        let dataref = response.data_ref;

        let result = panic::catch_unwind(|| {
//          println!("begin handle_request");
          let mut p = DataObject::get(dataref);
//          println!("handle_request");
          let o = handle_request(request.clone(), stream.try_clone().unwrap());
//          println!("request handled");
          p.put_object("a", o);
        });

        match result {
          Ok(_x) => (),
          Err(e) => {

            let s = match e.downcast::<String>() {
              Ok(panic_msg) => format!("{}", panic_msg),
              Err(_) => "unknown error".to_string()
            };        

            let mut o = DataObject::new();
            let s = format!("<html><head><title>500 - Server Error</title></head><body><h2>500</h2>Server Error: {}</body></html>", s);
            o.put_string("body", &s);
            o.put_int("code", 500);
            o.put_string("mimetype", "text/html");
            response.put_object("a", o);
          }
        }

        if headers.has("SEC-WEBSOCKET-KEY") { 
          fire_event("app", "WEBSOCK_END", request.clone()); 
          let sockref = request.get_int("websocket_id");
          WEBSOCKHEAP.get().write().unwrap().decr(sockref as usize);
        }
        else {
          let mut response = response.get_object("a").clone();

          let body:String;
          let mimetype:String;
          let len:i64;
          let code:u16;
          let msg:String;
          let mut headers:DataObject;

          let mut isfile = response.has("file") && response.get_property("file").is_string();
          let mut isbytes = response.has("body") && response.get_property("body").is_bytes();

          if isbytes {
            let bytes = response.get_bytes("body");
            let mt = bytes.get_mime_type();
            if mt.is_some() { response.put_string("mimetype", &mt.unwrap()); }
            if bytes.current_len() == 3 && bytes.get_data() == [52, 48, 52] {
              let p = "html/404.html";
              if Path::new(&p).exists() {
                response.put_string("file", &p);
                response.put_string("mimetype", "text/html");
                isfile = true;
              }
              response.put_int("code", 404);
              response.put_string("msg", "NOT FOUND");
              isbytes = false;
            }
          }

          if isfile { body = response.get_string("file"); }
          else if response.has("body") && response.get_property("body").is_string() { body = response.get_string("body"); }
          else { body = "".to_owned(); }

          if response.has("code") && response.get_property("code").is_int() { code = response.get_int("code") as u16; }
          else { code = 200; }

          if response.has("msg") && response.get_property("msg").is_string() { msg = response.get_string("msg"); }
          else { 
            if code < 200 { msg = "INFO".to_string(); }
            else if code < 300 { msg = "OK".to_string(); }
            else if code < 400 { msg = "REDIRECT".to_string(); }
            else if code < 500 { msg = "CLIENT ERROR".to_string(); }
            else { msg = "SERVER ERROR".to_string(); }
          }

          if response.has("headers") && response.get_property("headers").is_object() { headers = response.get_object("headers"); }
          else { headers = DataObject::new(); }

          if response.has("mimetype") && response.get_property("mimetype").is_string() { mimetype = response.get_string("mimetype"); }
          else if headers.has("Content-Type") { mimetype = headers.get_string("Content-Type"); }
          else if isfile { mimetype = mime_type(cmd); }
          else { mimetype = "text/plain".to_string(); }

          if response.has("len") && response.get_property("len").is_int() { len = response.get_int("len"); }
          else if headers.has("Content-Length") { len = headers.get_int("Content-Length"); }
          else if isfile { len = fs::metadata(&body).unwrap().len() as i64; }
          else if isbytes { 
            let bytes = response.get_bytes("body");
            let x = bytes.stream_len();
            if x != 0 { len = x as i64; }
            else { len = -1; }
          }
          else { len = body.len() as i64; }

          //FIXME
          //		int[] range = extractRange(len, h);
          //		if (range[1] != -1) len = range[1] - range[0] + 1;
          //		String res = range[0] == -1 ? "200 OK" : "206 Partial Content";

          let date = RFC2822Date::new(now).to_string();

          headers.put_string("Date", &date);
          headers.put_string("Content-Type", &mimetype);
          if len == -1 { ka = "close".to_string(); }
          else { headers.put_string("Content-Length", &len.to_string()); }
          // FIXME
          //      if (acceptRanges != null) h.put("Accept-Ranges", acceptRanges);
          //      if (range != null && range[0] != -1) h.put("Content-Range","bytes "+range[0]+"-"+range[1]+"/"+range[2]);
          //      if (expires != -1) h.put("Expires", toHTTPDate(new Date(expires)));

          let session_id = request.get_object("session").get_string("id");
          let later = now + 31536000000; // system.get_object("config").get_int("sessiontimeoutmillis");
          let cookie = "sessionid=".to_string()+&session_id+"; Path=/; Expires="+&RFC2822Date::new(later).to_string();
          headers.put_string("Set-Cookie", &cookie);

          // FIXME
          //		if (origin != null)
          //		{
          //			String cors = getCORS(name, origin);
          //			if (cors != null)
          //			{
          //				h.put("Access-Control-Allow-Origin", cors);
          //				if (!cors.equals("*")) h.put("Vary", "Origin");
          //			}
          //		}

          let mut reshead = "HTTP/1.1 ".to_string()+&code.to_string()+" "+&msg+"\r\n";
          for (k,v) in headers.objects() {
            reshead = reshead +&k + ": "+&Data::as_string(v)+"\r\n";
          }
          reshead = reshead + "\r\n";

          if isfile {
            let _x = stream.write(reshead.as_bytes());
            let mut file = fs::File::open(&body).unwrap();
            let chunk_size = core::cmp::min(file.metadata().unwrap().len(), 65024) as usize;
            loop {
              let mut chunk = Vec::with_capacity(chunk_size);
              let n = std::io::Read::by_ref(&mut file).take(chunk_size as u64).read_to_end(&mut chunk).unwrap();
              if n == 0 { break; }
              let x = stream.write(&chunk);
              if x.is_err() { break; }
              if n < chunk_size { break; }
            }
          }
          else if isbytes {
//            println!("begin send response");
            let bytes = response.get_bytes("body");
            let _x = stream.write(reshead.as_bytes());
            let mut timeout = 0;
            while bytes.is_read_open() {
              let chunk_size = core::cmp::max(0x4000, bytes.current_len());
              let chunk = bytes.read(chunk_size);
              let x = stream.write(&chunk);
              if x.is_err() { break; }
              if chunk.len() == 0 { 
                timeout += 1;
                let beat = Duration::from_millis(timeout);
                thread::sleep(beat);
                if timeout > 246 { println!("Unusually long wait for stream data... Abort"); break; }
              }
              else { timeout = 0; }
            }
            bytes.close_read();
//            println!("response sent");
          }
          else {
            let response = reshead + &body;
            let _x = stream.write(response.as_bytes());
          }

          fire_event("app", "HTTP_END", response);

          let _x = stream.flush();
        }
//        if ka.to_lowercase() == "keep-alive" { keepalivecount += 1; }
        if ka.to_lowercase() != "keep-alive" { break; }

        DataStore::gc();
//        println!("end http request");
      }
//      println!("close http connection");
    });
  }
}

pub fn handle_request(request: DataObject, stream: TcpStream) -> DataObject {
  let session_id = prep_request(request.clone());
  handle_websocket(request.clone(), stream, session_id.to_owned());
  do_get(request, session_id)
}

pub fn prep_request(mut request: DataObject) -> String {
  let system = DataStore::globals().get_object("system");

  let params = request.get_object("params");
  let mut headers = request.get_object("headers");
    
  let mut session_id = "".to_string();
  if params.has("session_id") { session_id = params.get_string("session_id"); }
  else {
    if headers.has("COOKIE") {
      let cookies = headers.get_string("COOKIE");
      let sa = cookies.split(";");
      for cookie in sa {
        let cookie = cookie.trim();
        if cookie.starts_with("sessionid="){
          session_id = cookie[10..].to_string();
          break;
        }
      }
    }
  }
  if session_id == "" { session_id = unique_session_id(); }
//  println!("{}", session_id);
  let mut sessions = system.get_object("sessions");
  let mut session;
  if !sessions.has(&session_id) {
    session = DataObject::new();
    session.put_int("count", 0);
    session.put_string("id", &session_id);

    let mut user = DataObject::new();
    user.put_string("displayname", "Anonymous");
    user.put_array("groups", DataArray::new());
    user.put_string("username", "anonymous");
    session.put_string("username", "anonymous");
    session.put_object("user", user);
    
    sessions.put_object(&session_id, session.clone());
  }
  else {
    session = sessions.get_object(&session_id);
  }
  
  let expire = time() + system.get_object("config").get_int("sessiontimeoutmillis");
  session.put_int("expire", expire);
  
  let count = session.get_int("count") + 1;
  session.put_int("count", count);
  
  if session.has("user") {
    headers.put_string("nn-username", &session.get_string("username"));
    let groups = session.get_object("user").get_array("groups");
    headers.put_array("nn-groups", groups);
  }
  else {
    headers.put_string("nn-username", "anonymous");
    headers.put_string("nn-groups", "anonymous");
  }
  
  request.put_object("session", session);
  request.put_string("sessionid", &session_id);
  
  session_id
}

pub fn handle_websocket(mut request: DataObject, mut stream: TcpStream, session_id:String) -> bool {
  let headers = request.get_object("headers");
  if ! headers.has("SEC-WEBSOCKET-KEY") { return false; }
  
  stream.set_read_timeout(None).expect("set_read_timeout call failed");

  let key = headers.get_string("SEC-WEBSOCKET-KEY");
  let key = key.trim();
  let key = key.to_string()+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  let mut checksum = SHA1::new();
  let _hash = checksum.update(&key);
  let hash = checksum.finish();
  let key2: String = Base64::encode(hash).into_iter().collect();
  let mut response = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n".to_string();
  response += "Sec-WebSocket-Accept: ";
  response += key2.trim();
  response += "\r\n";
  response += "Sec-WebSocket-Protocol: newbound\r\n\r\n";
  stream.write(response.as_bytes()).unwrap();

  let subs = DataObject::new();
  let subref = subs.data_ref;
  let con = WebsockConnection{
    stream: stream.try_clone().unwrap(),
    sub: subs,
  };
  let sockref = WEBSOCKHEAP.get().write().unwrap().push(con);
  request.put_int("websocket_id", sockref as i64);

  fire_event("app", "WEBSOCK_BEGIN", request.clone());

  let base:i64 = 2;
  let pow7 = base.pow(7);

  let system = DataStore::globals().get_object("system");
  loop {
    if !system.get_boolean("running") { break; }

    let mut lastopcode = 0;
    let mut baos: Vec<u8> = Vec::new();

    loop {
      let mut buf = [0; 1];
      let _ = stream.read_exact(&mut buf).unwrap();
      let i = buf[0] as i64;
      let fin = (pow7 & i) != 0;
      let rsv1 = (base.pow(6) & i) != 0;
      let rsv2 = (base.pow(5) & i) != 0;
      let rsv3 = (base.pow(4) & i) != 0;

      if rsv1 || rsv2 || rsv3 { panic!("Websocket failed - Unimplimented"); } 

      let mut opcode = 0xf & i;

      let _ = stream.read_exact(&mut buf).unwrap();
      let i = buf[0] as i64;
      let mask = (pow7 & i) != 0;
      if !mask { panic!("Websocket failed - Mask required"); } 

      let mut len = i - pow7;

      if len == 126 {
        let mut buf = [0; 2];
        let _ = stream.read_exact(&mut buf).unwrap();
        len = (buf[0] as i64 & 0x000000FF) << 8;
        len += buf[1] as i64 & 0x000000FF;
      }
      else if len == 127 {
        let mut buf = [0; 8];
        let _ = stream.read_exact(&mut buf).unwrap();
        len = (buf[0] as i64 & 0x000000FF) << 56;
        len += (buf[1] as i64 & 0x000000FF) << 48;
        len += (buf[2] as i64 & 0x000000FF) << 40;
        len += (buf[3] as i64 & 0x000000FF) << 32;
        len += (buf[4] as i64 & 0x000000FF) << 24;
        len += (buf[5] as i64 & 0x000000FF) << 16;
        len += (buf[6] as i64 & 0x000000FF) << 8;
        len += buf[7] as i64 & 0x000000FF;
      }

      // FIXME - Should read larger messages in chunks
      // if len > 4096 { panic!("Websocket message too long ({})", len); } 
      let len = len as usize;

      let mut maskkey = [0; 4];
      let _ = stream.read_exact(&mut maskkey).unwrap();

      let mut buf = vec![0; len as usize];
      let _ = stream.read_exact(&mut buf).unwrap();
      let mut i:usize = 0;
      while i < len {
        buf[i] = buf[i] ^ maskkey[i % 4];
        i += 1;
      }

      baos.append(&mut buf);

      if opcode == 0 {
        println!("continuation frame");
      }
      else if opcode == 1 || opcode == 2 { lastopcode = opcode; }
      else if opcode == 8 {  break; } // panic!("Websocket closed"); } 
      else if opcode == 9 {
        println!("ping");
      }
      else if opcode == 10 {
        println!("pong");
      }
      else {
        println!("UNEXPECTED OPCODE: {}", opcode);
      }

      if fin {
        if opcode == 0 {
          opcode = lastopcode;
        }

        if opcode == 1 {
          // text frame
          break;
        }
        else if opcode == 2 {
          // binary frame
          // FIXME - passing text anyway.
          break;
        }
      }
    }

    let msg = std::str::from_utf8(&baos);
    if msg.is_err() { break; }
    
    let msg = msg.unwrap().to_owned();        

    let stream = stream.try_clone().unwrap();
    let request = request.clone();
    let sid = session_id.to_owned();
    thread::spawn(move || {
      if msg.starts_with("cmd ") {
        let msg = &msg[4..];
        let mut d = DataObject::from_string(msg);

        let mut params = d.get_object("params").deep_copy();

        for (k,v) in request.objects() {
//          if k != "params" {
            params.set_property(&("nn_".to_string()+&k), v);
//          }
        }
        d.put_object("params", params);

        let o = handle_command(d, sid);
        // FIXME - Remove the dead ones
        websock_message(stream, o.to_string());
      }
      else if msg.starts_with("sub ") {
        let msg = &msg[4..];
        let d = DataObject::from_string(msg);
        let app = d.get_string("app");
        let event = d.get_string("event");
        let mut subs = DataObject::get(subref);
        if !subs.has(&app) { subs.put_array(&app, DataArray::new()); }
        subs.get_array(&app).push_string(&event);
      }
      else {
        println!("Unknown websocket command: {}", msg);
      }
    });
  }
  true
}

pub fn do_get(mut request:DataObject, session_id:String) -> DataObject {
  let system = DataStore::globals().get_object("system");
  let mut res = DataObject::new();
  
  let path = hex_decode(request.get_string("path"));
  let mut p = "html".to_string() + &path;
  let mut b = false;
  
  let params = request.get_object("params");
  
  if Path::new(&p).exists() {
    let md = metadata(&p).unwrap();
    if md.is_dir() {
      if !p.ends_with("/") { p += "/"; }
      p += "index.html";
      if Path::new(&p).exists() { b = true; }
    }
    else { b = true; }
  }
  
  if b {
    res.put_string("file", &p);
    res.put_string("mimetype", &mime_type(p));
  }
  else if path == "/" {
    let default_app = system.get_string("default_app");
    let p = "/".to_owned()+&default_app+"/index.html";
    res.put_int("code", 302);
    res.put_string("msg", "FOUND");
    let mut h = DataObject::new();
    h.put_string("Location", &p);
    res.put_object("headers", h);
  }
  else {
    {
      // Not a websocket, try app
      let mut sa = path.split("/");
      let appname = sa.nth(1).unwrap().to_string();
      let apps = system.get_object("apps");
      if apps.has(&appname) {
        let app = apps.get_object(&appname);
        request.put_object("app", app);
        let mut a = DataArray::new();
        for mut s in sa {
          if s == "" { s = "index.html"; }
          a.push_string(s);
        }
        if a.len() == 0 { a.push_string("index.html"); }
        
        let cmd = a.get_string(0);
        let mut path = cmd.to_owned();
        a.remove_property(0);
        for p in a.objects() {
          path += "/";
          path += &p.string();
        }
        
        // try app html dir
        let mut p = "runtime/".to_string()+&appname+"/html/"+&path;

        if Path::new(&p).exists() {
          let md = metadata(&p).unwrap();
          if md.is_dir() {
            if !p.ends_with("/") { p += "/"; }
            p += "index.html";
            if Path::new(&p).exists() { b = true; }
          }
          else { b = true; }
        }
        
        if b {
          res.put_string("file", &p);
          res.put_string("mimetype", &mime_type(p));
        }
        else {
          // try app src dir
          let mut p = "runtime/".to_string()+&appname+"/src/html/"+&appname+"/"+&path;

          if Path::new(&p).exists() {
            let md = metadata(&p).unwrap();
            if md.is_dir() {
              if !p.ends_with("/") { p += "/"; }
              p += "index.html";
              if Path::new(&p).exists() { b = true; }
            }
            else { b = true; }
          }
          
          if b {
            res.put_string("file", &p);
            res.put_string("mimetype", &mime_type(p));
          }
          else {
            // try app command
            let mut d = DataObject::new();
            d.put_string("bot", &appname);
            d.put_string("cmd", &cmd);
            d.put_int("pid", 0);
            let mut params = params.deep_copy();
            d.put_object("params", params.clone());
            
            for (k,v) in request.objects() {
//              if k != "params" {
                params.set_property(&("nn_".to_string()+&k), v);
//              }
            }
            
            let d = handle_command(d, session_id.to_owned());
            let r = d.get_string("nn_return_type");
            if r != "404" {
              b = true;
              if r == "File" {
                res.put_string("file", &d.get_string("data"));
                res.put_string("mimetype", &mime_type(p));
              }
              else if r == "InputStream" {
                res.put_bytes("body", d.get_bytes("data"));
                res.put_string("mimetype", &mime_type(p));
              }
              else {
                let s;
                if params.has("callback") {
                  s = params.get_string("callback") + "(" + &d.to_string() + ")";
                }
                else {
                  s = d.to_string();
                }
                res.put_string("body", &s);
                res.put_string("mimetype", "application/json");
              }
            }
          }
        }
      }
    }
    
    if !b {
      // 404
      let p = "html/404.html";
      if Path::new(&p).exists() {
        res.put_string("file", &p);
        res.put_string("mimetype", "text/html");
      }
      res.put_int("code", 404);
      res.put_string("msg", "NOT FOUND");
    }
  }

  res
}

fn websock_message(mut stream: TcpStream, msg:String){
  let msg = msg.as_bytes();
  
  let n = msg.len() as i64;
  let mut reply: Vec<u8> = Vec::new();

  reply.push(129); // Text = 129 / Binary = 130;

  if n < 126 {
    reply.push((n & 0xFF) as u8);
  }
  else if n < 65536 {
    reply.push(126);
    reply.push(((n >> 8) & 0xFF) as u8);
    reply.push((n & 0xFF) as u8);
  }
  else {
    reply.push(127);
    reply.push(((n >> 56) & 0xFF) as u8);
    reply.push(((n >> 48) & 0xFF) as u8);
    reply.push(((n >> 40) & 0xFF) as u8);
    reply.push(((n >> 32) & 0xFF) as u8);
    reply.push(((n >> 24) & 0xFF) as u8);
    reply.push(((n >> 16) & 0xFF) as u8);
    reply.push(((n >> 8) & 0xFF) as u8);
    reply.push((n & 0xFF) as u8);
  }

  reply.extend_from_slice(msg);

  let x = stream.write(&reply);
  // FIXME - Remove the dead ones
  if x.is_err() { println!("WEBSOCKET DIED"); }
}

pub fn handle_command(d: DataObject, sid: String) -> DataObject {
  let system = DataStore::globals().get_object("system");
  let sessions = system.get_object("sessions");
  if sessions.has(&sid){
    let mut session = sessions.get_object(&sid);
    //println!("session {}", session.to_string());
    let mut user = session.get_object("user");
    let last_contact = time();
    let expire = last_contact + system.get_object("config").get_int("sessiontimeoutmillis");
    session.put_int("expire", expire);
    user.put_int("last_contact", last_contact);
  }
  
  let app = d.get_string("bot");
  let cmd = d.get_string("cmd");
  let pid = d.get_property("pid");
  let params = d.get_object("params");
  
  let mut o;
  if d.has("peer") {
    o = exec(d.get_string("peer"), app, cmd, params);
  }
  else {
    let (b, ctldb, id) = lookup_command_id(app, cmd.to_owned());

    if b {
      let command = Command::new(&ctldb, &id);
      if check_security(&command, &sid) {
        command.cast_params(params.clone());

        let response = DataObject::new();
        let dataref = response.data_ref;
        let r = command.return_type.to_owned();

        let result = panic::catch_unwind(|| {
          let mut p = DataObject::get(dataref);
          let o = command.execute(params).unwrap();
          p.put_object("a", o);
        });

        match result {
          Ok(_x) => {
            let oo = response.get_object("a");
            o = format_result(command, oo);
            o.put_string("nn_return_type", &r);
          },
          Err(e) => {
            let msg = match e.downcast::<String>() {
              Ok(panic_msg) => format!("{}", panic_msg),
              Err(x) => format!("Unknown Error {:?}", x)
            };        
            o = DataObject::new();
            o.put_string("status", "err");
            o.put_string("msg", &msg);
            o.put_string("nn_return_type", "500");
          },
        }
      }
      else {
        o = DataObject::new();
        o.put_string("status", "err");
        let err = format!("UNAUTHORIZED: {}", &cmd);
        o.put_string("msg", &err);
        o.put_string("nn_return_type", "String");
      }
    }
    else {
      o = DataObject::new();
      o.put_string("status", "err");
      let err = format!("Unknown command: {}", &cmd);
      o.put_string("msg", &err);
      o.put_string("nn_return_type", "404");
    }
  }
  
  if !o.has("status") { o.put_string("status", "ok"); }
  o.set_property("pid", pid);
  o
}

fn read_line(reader: &mut TcpStream) -> String {
  let mut buf = [0];
  let mut line: String = "".to_string();
  loop {
    let res = reader.read_exact(&mut buf);
    if res.is_err() { break; }
    line = line + &std::str::from_utf8(&buf).unwrap();
    if buf[0] == b'\r' {
      let res = reader.read_exact(&mut buf);
      if res.is_err() { break; }
      line = line + std::str::from_utf8(&buf).unwrap();
      if buf[0] == b'\n' {
        break;
      }
    }
    if line.len() >= 4096 { break; } // FIXME - What is an appropriate max HTTP request line length?
  }
  line
}

fn read_until(reader: &mut TcpStream, c: u8, bufout: &mut Vec<u8>) -> usize {
  let mut buf = [0];
  let mut i = 0;
  loop {
    let res = reader.read_exact(&mut buf);
    if res.is_err() { break; }
    i += 1;
    bufout.push(buf[0]);
    if buf[0] == c {
      break;
    }
    if i >= 4096 { break; } // FIXME - What is an appropriate max HTTP request line length?
  }
  i
}

pub fn format_result(command:Command, o:DataObject) -> DataObject {
  let mut d;
                
  if command.return_type == "FLAT" { 
    if command.lang == "flow" && o.clone().keys().len() > 1 {
      d = o; 
    }
    else {
      if o.has("a") { d = o.get_object("a"); }
      else if o.has("data") { d = o.get_object("data"); }
      else { d = o.objects()[0].1.object(); }
    }
  }
  else {
    d = DataObject::new();
    let oo;
    if o.has("a") { oo = o.get_property("a"); }
    else if o.has("data") { oo = o.get_property("data"); }
    else if o.has("msg") { oo = o.get_property("msg"); }
    else { oo = o.objects()[0].1.clone(); }
    if command.return_type == "String" {
      d.set_property("msg", oo.clone());
    }
    else {
      d.set_property("data", oo.clone());
    }
  }
  
  if !d.has("status") { d.put_string("status", "ok"); }
  
  d
}

