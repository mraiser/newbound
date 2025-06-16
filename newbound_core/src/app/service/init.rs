use ndata::dataobject::DataObject;
use std::thread;
use std::panic;
use std::fs;
use flowlang::datastore::*;
use std::net::TcpListener;
use flowlang::appserver::save_config;
use flowlang::appserver::fire_event;
use flowlang::flowlang::system::unique_session_id::unique_session_id;
use flowlang::flowlang::system::time::time;
use flowlang::flowlang::http::hex_decode::hex_decode;
use std::net::TcpStream;
use std::sync::Once;
// Removed: use state::Storage;
// Removed: use std::sync::RwLock;
use ndata::sharedmutex::GlobalSharedMutex; // Added for GlobalSharedMutex
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
use ndata::Data;
use ndata::dataarray::DataArray;

#[cfg(not(feature = "webview"))]
use flowlang::flowlang::system::system_call::system_call;
#[cfg(not(feature = "webview"))]
use crate::security::security::init::get_user;
#[cfg(not(feature = "webview"))]
use crate::security::security::init::log_in;

pub fn execute(_: DataObject) -> DataObject {
    let ax = init();
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn init() -> String {
  START.call_once(|| {
    // Modified: Use GlobalSharedMutex's init method
    WEBSOCKHEAP.init(Heap::new());
  });

  let beat = Duration::from_millis(10);
  let system = DataStore::globals().get_object("system");
  while !system.has("security_ready") { thread::sleep(beat); }

  // Start HTTP
  thread::spawn(http_listen);

  let hook = |app: &str, event: &str, data: DataObject| {
    let de = Data::DString(event.to_string());
    // Modified: Use .lock() instead of .get().write().unwrap()
    let mut sockheap = WEBSOCKHEAP.lock();
    for sockref in sockheap.keys(){
      let sock = sockheap.get(sockref);
      let subs = sock.sub.clone();
      if subs.has(&app){
        let app_subs = subs.get_array(&app); // Renamed variable to avoid conflict
        if app_subs.index_of(de.clone()) != -1 {
          let stream = sock.stream.try_clone().unwrap();
          // FIXME - Remove the dead ones
          if !websock_message(stream, data.to_string()) {
            //sockheap.decr(sockref); // Ensure .decr() is available on Heap or via DerefMut
            println!("DEAD WEBSOCK {}", sockref);
          }
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
// Modified: Replaced Storage<RwLock<Heap<WebsockConnection>>> with GlobalSharedMutex
pub static WEBSOCKHEAP: GlobalSharedMutex<Heap<WebsockConnection>> = GlobalSharedMutex::new();

pub fn http_listen() {
  let mut system = DataStore::globals().get_object("system");
  let mut config = system.get_object("config");
  let ipaddr = config.get_string("http_address");
  let port_str = config.get_string("http_port"); // Renamed to avoid conflict with port variable
  let socket_address = ipaddr + ":" + &port_str;

  let b = port_str == "0";
  let listener = TcpListener::bind(socket_address).unwrap();
  let port = listener.local_addr().unwrap().port();
  println!("HTTP TCP listening on port {}", port);

  config.put_int("http_port", port as i64);
  if b { save_config(config.clone()); }

  system.put_boolean("http_ready", true);

  #[cfg(not(feature = "webview"))]
  if !config.has("headless") || !(Data::as_string(config.get_property("headless")) == "true".to_string()) {
    let user_opt = get_user("admin"); // Renamed to avoid conflict
    if user_opt.is_some(){
      thread::spawn(move || {
        let user = user_opt.unwrap();

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
          a.push_string("xdg-open");
          a.push_string(&s);
          system_call(a);
        }
      });
    }
  }

  let max_keep_alive = Duration::from_millis(3000);
  for stream_result in listener.incoming() { // Renamed stream to stream_result
    let mut stream = stream_result.unwrap();
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
        let count_space = line.find(" ").unwrap(); // Renamed count to count_space
        let method = (&line[0..count_space]).to_string();
        line = (&line[count_space+1..]).to_string();
        let count_space_opt = line.find(" "); // Renamed count to count_space_opt
        if count_space_opt.is_none() {
          println!("HTTP TCP unexpected request protocol: {}", line);
          return;
        }

        let count_space2 = count_space_opt.unwrap(); // Renamed count to count_space2
        let protocol = (&line[count_space2+1..]).to_string();
        let path = (&line[0..count_space2]).to_string();

        let mut headers = DataObject::new();
        let mut last = "".to_string();
        loop {
          let line_header = read_line(&mut stream); // Renamed line to line_header
          let mut count_header = line_header.len(); // Renamed count to count_header
          if count_header <= 2 {
            break;
          }
          if (&line_header[0..1]).to_string() != " ".to_string(){
            count_header = line_header.find(":").unwrap();
            let mut key = (&line_header[0..count_header]).to_string();
            key = key.to_uppercase();
            let mut val = (&line_header[count_header+1..]).to_string();
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
              old = old + "\r\n" + line_header.trim_end();
              v.push_string(&old);
            }
            else {
              let mut old = d.string();
              old = old + "\r\n" + line_header.trim_end();
              headers.put_string(&last, &old);
            }
          }
        }

        let mut querystring = "".to_string();
        let mut params = DataObject::new();

        if method == "POST" {
          // extractPOSTParams
          let clstr = headers.get_string("CONTENT-LENGTH");
          let ctstr = match headers.has("CONTENT-TYPE") {
            true => headers.get_string("CONTENT-TYPE"),
            false => "text/plain".to_string()
          };
          let mut max = clstr.parse::<i64>().unwrap();

          let s = ctstr.to_lowercase();
          if s.starts_with("multipart/") {
            // MULTIPART
            panic!("No MIME MULTIPART support yet");
          }
          else {
            while max > 0 {
              let mut b_post = false; // Renamed b to b_post
              let mut buf = vec![];
              let n = read_until(&mut stream, b'=', &mut buf);
              max -= n as i64;
              let mut key = String::from_utf8_lossy(&buf).to_string();
              if key.ends_with("=") {
                key = (&key[..n-1]).to_string();
              }

              buf = vec![];
              let n_val = read_until(&mut stream, b'&', &mut buf); // Renamed n to n_val
              max -= n_val as i64;
              let mut value = String::from_utf8_lossy(&buf).to_string();
              if value.ends_with("&") {
                value = (&value[..n_val-1]).to_string();
              }
              else { b_post = true; }

              key = key.replace("+"," ");
              value = value.replace("+"," ");
              key = hex_decode(key);
              value = hex_decode(value);

              params.put_string(&key, &value);

              if b_post { break; }
            }
          }
        }

        let cmd_path:String; // Renamed cmd to cmd_path
        if path.contains("?"){
          let i = path.find("?").unwrap();
          cmd_path = path[0..i].to_string();
          querystring = path[i+1..].to_string();
          let mut oneline = querystring.to_owned();
          let mut oneparam:String;
          while oneline.len() > 0 {
            if oneline.contains("&")  {
              let i_amp = oneline.find("&").unwrap(); // Renamed i to i_amp
              oneparam = oneline[0..i_amp].to_string();
              oneline = oneline[i_amp+1..].to_string();
            }
            else {
              oneparam = oneline;
              oneline = "".to_string();
            }

            if oneparam.contains("=") {
              let i_eq = oneparam.find("=").unwrap(); // Renamed i to i_eq
              let key = hex_decode(oneparam[0..i_eq].to_string());
              let value = hex_decode(oneparam[i_eq+1..].to_string());
              params.put_string(&key, &value);
            }
          }
        }
        else {
          cmd_path = path;
        }
        let loc = remote_addr.to_string();
        headers.put_string("nn-userlocation", &loc);
        let mut request = DataObject::new();

        if headers.has("ACCEPT-LANGUAGE"){
          let lang = headers.get_string("ACCEPT-LANGUAGE");
          request.put_string("language", &lang);
        }
        else {
          request.put_string("language", "*");
        }

        if headers.has("HOST"){
          let h = headers.get_string("HOST");
          request.put_string("host", &h);
        }

        if headers.has("REFERER"){
          let h = headers.get_string("REFERER");
          request.put_string("referer", &h);
        }

        request.put_string("protocol", &protocol);
        request.put_string("path", &cmd_path);
        request.put_string("loc", &loc);
        request.put_string("method", &method);
        request.put_string("querystring", &querystring);
        request.put_object("headers", headers.clone()); // Clone headers before moving to request
        request.put_object("params", params);

        let now = time();
        request.put_int("timestamp", now);

        fire_event("app", "HTTP_BEGIN", request.clone());

        if headers.has("TRANSFER-ENCODING"){
          let trenc = headers.get_string("TRANSFER-ENCODING");
          if trenc.to_uppercase() == "CHUNKED" {
            // CHUNKED
          }
        }

        let mut ka;
        if headers.has("CONNECTION") { ka = headers.get_string("CONNECTION"); }
        else { ka = "close".to_string(); }

        let mut response_obj = DataObject::new(); // Renamed response to response_obj to avoid conflict
        let dataref = response_obj.data_ref;

        let result = panic::catch_unwind(|| {
          let mut p = DataObject::get(dataref);
          let o = handle_request(request.clone(), stream.try_clone().unwrap());
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
            let s_html = format!("<html><head><title>500 - Server Error</title></head><body><h2>500</h2>Server Error: {}</body></html>", s); // Renamed s to s_html
            o.put_string("body", &s_html);
            o.put_int("code", 500);
            o.put_string("mimetype", "text/html");
            response_obj.put_object("a", o); // Use response_obj
          }
        }

        if headers.has("SEC-WEBSOCKET-KEY") {
          fire_event("app", "WEBSOCK_END", request.clone());
          let sockref = request.get_int("websocket_id");
          // Modified: Use .lock()
          WEBSOCKHEAP.lock().decr(sockref as usize);
        }
        else {
          let mut final_response = response_obj.get_object("a").clone(); // Use response_obj, Renamed response to final_response

          let body_content:String; // Renamed body to body_content
          let mimetype:String;
          let len:i64;
          let code:u16;
          let msg:String;
          let mut response_headers:DataObject; // Renamed headers to response_headers

          let mut isfile = final_response.has("file") && final_response.get_property("file").is_string();
          let mut isbytes = final_response.has("body") && final_response.get_property("body").is_bytes();

          if isbytes {
            let bytes = final_response.get_bytes("body");
            let mt = bytes.get_mime_type();
            if mt.is_some() { final_response.put_string("mimetype", &mt.unwrap()); }
            if bytes.current_len() == 3 && bytes.get_data() == [52, 48, 52] { // "404"
              let p = "html/404.html";
              if Path::new(&p).exists() {
                final_response.put_string("file", &p);
                final_response.put_string("mimetype", "text/html");
                isfile = true;
              }
              final_response.put_int("code", 404);
              final_response.put_string("msg", "NOT FOUND");
              isbytes = false;
            }
          }

          if isfile { body_content = final_response.get_string("file"); }
          else if final_response.has("body") && final_response.get_property("body").is_string() { body_content = final_response.get_string("body"); }
          else { body_content = "".to_owned(); }

          if final_response.has("code") && final_response.get_property("code").is_int() { code = final_response.get_int("code") as u16; }
          else { code = 200; }

          if final_response.has("msg") && final_response.get_property("msg").is_string() { msg = final_response.get_string("msg"); }
          else {
            if code < 200 { msg = "INFO".to_string(); }
            else if code < 300 { msg = "OK".to_string(); }
            else if code < 400 { msg = "REDIRECT".to_string(); }
            else if code < 500 { msg = "CLIENT ERROR".to_string(); }
            else { msg = "SERVER ERROR".to_string(); }
          }

          if final_response.has("headers") && final_response.get_property("headers").is_object() { response_headers = final_response.get_object("headers"); }
          else { response_headers = DataObject::new(); }

          if final_response.has("mimetype") && final_response.get_property("mimetype").is_string() { mimetype = final_response.get_string("mimetype"); }
          else if response_headers.has("Content-Type") { mimetype = response_headers.get_string("Content-Type"); }
          else if isfile { mimetype = mime_type(cmd_path.clone()); } // Use cmd_path
          else { mimetype = "text/plain".to_string(); }

          if final_response.has("len") && final_response.get_property("len").is_int() { len = final_response.get_int("len"); }
          else if response_headers.has("Content-Length") { len = response_headers.get_int("Content-Length"); }
          else if isfile {
            let lenx = fs::metadata(&body_content);
            if lenx.is_ok() { len = lenx.unwrap().len() as i64; }
            else {
              final_response.put_int("code", 404); // Modify final_response
              final_response.put_string("msg", "NOT FOUND");
              isfile = false;
              len = -1;
            }
          }
          else if isbytes {
            let bytes = final_response.get_bytes("body");
            let x = bytes.stream_len();
            if x != 0 { len = x as i64; }
            else { len = -1; }
          }
          else { len = body_content.len() as i64; }

          let date = RFC2822Date::new(now).to_string();

          response_headers.put_string("Date", &date);
          response_headers.put_string("Content-Type", &mimetype);
          if len == -1 { ka = "close".to_string(); }
          else { response_headers.put_string("Content-Length", &len.to_string()); }

          let session_id_cookie = request.get_object("session").get_string("id"); // Renamed session_id to session_id_cookie
          let later = now + 31536000000;
          let cookie = "sessionid=".to_string() + &session_id_cookie + "; Path=/; Expires=" + &RFC2822Date::new(later).to_string();
          response_headers.put_string("Set-Cookie", &cookie);

          let cors = "*";
          response_headers.put_string("Access-Control-Allow-Origin", cors);

          let mut reshead = "HTTP/1.1 ".to_string() + &code.to_string() + " " + &msg + "\r\n";
          for (k,v) in response_headers.objects() {
            reshead = reshead + &k + ": " + &Data::as_string(v) + "\r\n";
          }
          reshead = reshead + "\r\n";

          if isfile {
            let _x = stream.write(reshead.as_bytes());
            let mut file = fs::File::open(&body_content).unwrap();
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
            let bytes = final_response.get_bytes("body");
            let _x = stream.write(reshead.as_bytes());
            let mut timeout = 0;
            while bytes.is_read_open() {
              let chunk_size = core::cmp::max(0x4000, bytes.current_len()); // Ensure chunk_size is not zero if current_len is zero
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
          }
          else {
            let full_response_str = reshead + &body_content; // Renamed response to full_response_str
            let _x = stream.write(full_response_str.as_bytes());
          }

          fire_event("app", "HTTP_END", final_response); // Use final_response

          let _x = stream.flush();
        }
        if ka.to_lowercase() != "keep-alive" { break; }

        DataStore::gc();
      }
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
        let cookie_trimmed = cookie.trim(); // Renamed cookie to cookie_trimmed
        if cookie_trimmed.starts_with("sessionid="){
          session_id = cookie_trimmed[10..].to_string();
          break;
        }
      }
    }
  }
  if session_id == "" { session_id = unique_session_id(); }
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
    headers.put_string("nn-groups", "anonymous"); // Should likely be an empty array or specific string
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
  let key_trimmed = key.trim(); // Renamed key to key_trimmed
  let final_key = key_trimmed.to_string() + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"; // Renamed key to final_key
  let mut checksum = SHA1::new();
  let _hash = checksum.update(&final_key);
  let hash = checksum.finish();
  let key2: String = Base64::encode(hash).into_iter().collect();
  let mut response_str = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n".to_string(); // Renamed response to response_str
  response_str += "Sec-WebSocket-Accept: ";
  response_str += key2.trim();
  response_str += "\r\n";
  response_str += "Sec-WebSocket-Protocol: newbound\r\n\r\n";
  stream.write(response_str.as_bytes()).unwrap();

  let subs = DataObject::new();
  let subref = subs.data_ref;
  let con = WebsockConnection{
    stream: stream.try_clone().unwrap(),
    sub: subs,
  };
  // Modified: Use .lock()
  let sockref = WEBSOCKHEAP.lock().push(con);
  request.put_int("websocket_id", sockref as i64);

  fire_event("app", "WEBSOCK_BEGIN", request.clone());

  let base:i64 = 2;
  let pow7 = base.pow(7);
  let mut dead = false;

  let system = DataStore::globals().get_object("system");
  loop {
    if !system.get_boolean("running") { break; }

    let mut lastopcode = 0;
    let mut baos: Vec<u8> = Vec::new();

    loop {
      let mut buf = [0; 1];
      let q = stream.read_exact(&mut buf);
      if q.is_ok(){
        let i_val = buf[0] as i64; // Renamed i to i_val
        let fin = (pow7 & i_val) != 0;
        let rsv1 = (base.pow(6) & i_val) != 0;
        let rsv2 = (base.pow(5) & i_val) != 0;
        let rsv3 = (base.pow(4) & i_val) != 0;

        if rsv1 || rsv2 || rsv3 { panic!("Websocket failed - Unimplimented"); }

        let mut opcode = 0xf & i_val;

        let _ = stream.read_exact(&mut buf).unwrap();
        let i_mask_check = buf[0] as i64; // Renamed i to i_mask_check
        let mask = (pow7 & i_mask_check) != 0;
        if !mask { panic!("Websocket failed - Mask required"); }

        let mut len = i_mask_check - pow7;

        if len == 126 {
          let mut len_buf = [0; 2]; // Renamed buf to len_buf
          let _ = stream.read_exact(&mut len_buf).unwrap();
          len = (len_buf[0] as i64 & 0x000000FF) << 8;
          len += len_buf[1] as i64 & 0x000000FF;
        }
        else if len == 127 {
          let mut len_buf_large = [0; 8]; // Renamed buf to len_buf_large
          let _ = stream.read_exact(&mut len_buf_large).unwrap();
          len = (len_buf_large[0] as i64 & 0x000000FF) << 56;
          len += (len_buf_large[1] as i64 & 0x000000FF) << 48;
          len += (len_buf_large[2] as i64 & 0x000000FF) << 40;
          len += (len_buf_large[3] as i64 & 0x000000FF) << 32;
          len += (len_buf_large[4] as i64 & 0x000000FF) << 24;
          len += (len_buf_large[5] as i64 & 0x000000FF) << 16;
          len += (len_buf_large[6] as i64 & 0x000000FF) << 8;
          len += len_buf_large[7] as i64 & 0x000000FF;
        }

        let len_usize = len as usize; // Renamed len to len_usize

        let mut maskkey = [0; 4];
        let _ = stream.read_exact(&mut maskkey).unwrap();

        let mut payload_buf = vec![0; len_usize]; // Renamed buf to payload_buf
        let _ = stream.read_exact(&mut payload_buf).unwrap();
        let mut idx:usize = 0; // Renamed i to idx
        while idx < len_usize {
          payload_buf[idx] = payload_buf[idx] ^ maskkey[idx % 4];
          idx += 1;
        }

        baos.append(&mut payload_buf);

        if opcode == 0 {
          println!("continuation frame");
        }
        else if opcode == 1 || opcode == 2 { lastopcode = opcode; }
        else if opcode == 8 {  break; }
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
            break;
          }
          else if opcode == 2 {
            break;
          }
        }
      }
      else {
        println!("BAD WEBSOCK NO GOOD");
        dead = true;
        break;
      }
    }
    if dead { break; }

    let msg_str = "".to_string() + &String::from_utf8_lossy(&baos); // Renamed msg to msg_str
    if msg_str.starts_with("cmd ") || msg_str.starts_with("sub ") {

      let stream_clone = stream.try_clone().unwrap(); // Renamed stream to stream_clone
      let request_clone = request.clone(); // Renamed request to request_clone
      let sid_clone = session_id.to_owned(); // Renamed sid to sid_clone
      thread::spawn(move || {
        if msg_str.starts_with("cmd ") {
          let cmd_payload = &msg_str[4..]; // Renamed msg to cmd_payload
          let mut d = DataObject::from_string(cmd_payload);

          let mut params = d.get_object("params").deep_copy();

          for (k,v) in request_clone.objects() {
            params.set_property(&("nn_".to_string()+&k), v);
          }
          d.put_object("params", params);

          let o = handle_command(d, sid_clone);
          websock_message(stream_clone, o.to_string());
        }
        else if msg_str.starts_with("sub ") {
          let sub_payload = &msg_str[4..]; // Renamed msg to sub_payload
          let d = DataObject::from_string(sub_payload);
          let app = d.get_string("app");
          let event = d.get_string("event");
          let mut subs_obj = DataObject::get(subref); // Renamed subs to subs_obj
          if !subs_obj.has(&app) { subs_obj.put_array(&app, DataArray::new()); }
          subs_obj.get_array(&app).push_string(&event);
        }
        else {
          println!("Unknown websocket command: {}", msg_str);
        }
      });
    }
  }
  true
}

pub fn do_get(mut request:DataObject, session_id:String) -> DataObject {
  let system = DataStore::globals().get_object("system");
  let mut res = DataObject::new();

  let path_decoded = hex_decode(request.get_string("path")); // Renamed path to path_decoded
  let mut p = "html".to_string() + &path_decoded;
  let mut b_found = false; // Renamed b to b_found

  let params = request.get_object("params");

  if Path::new(&p).exists() {
    let md = metadata(&p).unwrap();
    if md.is_dir() {
      if !p.ends_with("/") { p += "/"; }
      p += "index.html";
      if Path::new(&p).exists() { b_found = true; }
    }
    else { b_found = true; }
  }

  if b_found {
    res.put_string("file", &p);
    res.put_string("mimetype", &mime_type(p.clone())); // Pass owned string or reference
  }
  else if path_decoded == "/" {
    let default_app = system.get_string("default_app");
    let p_redirect = "/".to_owned() + &default_app + "/index.html"; // Renamed p to p_redirect
    res.put_int("code", 302);
    res.put_string("msg", "FOUND");
    let mut h = DataObject::new();
    h.put_string("Location", &p_redirect);
    res.put_object("headers", h);
  }
  else {
    {
      let mut sa = path_decoded.split("/");
      if sa.clone().count() < 2 {
        println!("Unknown http request url {}", &path_decoded);
        // b_found remains false
      }
      else {
        let appname = sa.nth(1).unwrap().to_string();
        let apps = system.get_object("apps");
        if apps.has(&appname) {
          let app = apps.get_object(&appname);
          request.put_object("app", app);
          let mut a_path_parts = DataArray::new(); // Renamed a to a_path_parts
          for mut s_part in sa { // Renamed s to s_part
            if s_part == "" { s_part = "index.html"; }
            a_path_parts.push_string(s_part);
          }
          if a_path_parts.len() == 0 { a_path_parts.push_string("index.html"); }

          let cmd = a_path_parts.get_string(0);
          let mut current_path = cmd.to_owned(); // Renamed path to current_path
          a_path_parts.remove_property(0);
          for p_part in a_path_parts.objects() { // Renamed p to p_part
            current_path += "/";
            current_path += &p_part.string();
          }

          let mut p_app_html = "runtime/".to_string() + &appname + "/html/" + &current_path; // Renamed p to p_app_html

          if Path::new(&p_app_html).exists() {
            let md = metadata(&p_app_html).unwrap();
            if md.is_dir() {
              if !p_app_html.ends_with("/") { p_app_html += "/"; }
              p_app_html += "index.html";
              if Path::new(&p_app_html).exists() { b_found = true; }
            }
            else { b_found = true; }
          }

          if b_found {
            res.put_string("file", &p_app_html);
            res.put_string("mimetype", &mime_type(p_app_html.clone()));
          }
          else {
            let mut p_app_src = "runtime/".to_string() + &appname + "/src/html/" + &appname + "/" + &current_path; // Renamed p to p_app_src

            if Path::new(&p_app_src).exists() {
              let md = metadata(&p_app_src).unwrap();
              if md.is_dir() {
                if !p_app_src.ends_with("/") { p_app_src += "/"; }
                p_app_src += "index.html";
                if Path::new(&p_app_src).exists() { b_found = true; }
              }
              else { b_found = true; }
            }

            if b_found {
              res.put_string("file", &p_app_src);
              res.put_string("mimetype", &mime_type(p_app_src.clone()));
            }
            else {
              let mut d_cmd = DataObject::new(); // Renamed d to d_cmd
              d_cmd.put_string("bot", &appname);
              d_cmd.put_string("cmd", &cmd);
              d_cmd.put_int("pid", 0); // pid is Data enum, ensure correct type or conversion
              let mut params_clone = params.deep_copy(); // Renamed params to params_clone
              d_cmd.put_object("params", params_clone.clone());

              for (k,v) in request.objects() {
                params_clone.set_property(&("nn_".to_string()+&k), v);
              }

              let d_result = handle_command(d_cmd, session_id.to_owned()); // Renamed d to d_result
              let r_type = d_result.get_string("nn_return_type"); // Renamed r to r_type
              if r_type != "404" {
                b_found = true;
                if r_type == "File" {
                  res.put_string("file", &d_result.get_string("data"));
                  res.put_string("mimetype", &mime_type(p_app_src.clone())); // Or appropriate path
                }
                else if r_type == "InputStream" {
                  res.put_bytes("body", d_result.get_bytes("data"));
                  res.put_string("mimetype", &mime_type(p_app_src.clone())); // Or appropriate path
                }
                else {
                  let s_json;
                  if params.has("callback") {
                    s_json = params.get_string("callback") + "(" + &d_result.to_string() + ")";
                  }
                  else {
                    s_json = d_result.to_string();
                  }
                  res.put_string("body", &s_json);
                  res.put_string("mimetype", "application/json");
                }
              }
            }
          }
        }
      }
    }

    if !b_found {
      let p_404 = "html/404.html"; // Renamed p to p_404
      if Path::new(&p_404).exists() {
        res.put_string("file", &p_404);
        res.put_string("mimetype", "text/html");
      }
      res.put_int("code", 404);
      res.put_string("msg", "NOT FOUND");
    }
  }

  res
}

fn websock_message(mut stream: TcpStream, msg:String) -> bool {
  let msg_bytes = msg.as_bytes(); // Renamed msg to msg_bytes

  let n = msg_bytes.len() as i64;
  let mut reply: Vec<u8> = Vec::new();

  reply.push(129);

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

  reply.extend_from_slice(msg_bytes);

  let x = stream.write(&reply);
  x.is_ok()
}

pub fn handle_command(d: DataObject, sid: String) -> DataObject {
  let system = DataStore::globals().get_object("system");
  let sessions = system.get_object("sessions");
  if sessions.has(&sid){
    let mut session = sessions.get_object(&sid);
    let mut user = session.get_object("user");
    let last_contact = time();
    let expire = last_contact + system.get_object("config").get_int("sessiontimeoutmillis");
    session.put_int("expire", expire);
    user.put_int("last_contact", last_contact);
  }

  let app = d.get_string("bot");
  let cmd = d.get_string("cmd");
  let pid = d.get_property("pid"); // pid is Data, not necessarily i64
  let params = d.get_object("params");

  let mut o_result; // Renamed o to o_result
  if d.has("peer") {
    o_result = exec(d.get_string("peer"), app, cmd, params);
  }
  else {
    let (b_cmd_found, ctldb, id) = lookup_command_id(app, cmd.to_owned()); // Renamed b to b_cmd_found

    if b_cmd_found {
      let command = Command::new(&ctldb, &id);
      if check_security(&command, &sid) {
        command.cast_params(params.clone());

        let response_container = DataObject::new(); // Renamed response to response_container
        let dataref = response_container.data_ref;
        let r_return_type = command.return_type.to_owned(); // Renamed r to r_return_type

        let result = panic::catch_unwind(|| {
          let mut p_response_target = DataObject::get(dataref); // Renamed p to p_response_target
          let cmd_output = command.execute(params).unwrap(); // Renamed o to cmd_output
          p_response_target.put_object("a", cmd_output);
        });

        match result {
          Ok(_x) => {
            let oo_inner_result = response_container.get_object("a"); // Renamed oo to oo_inner_result
            o_result = format_result(command, oo_inner_result);
            o_result.put_string("nn_return_type", &r_return_type);
          },
          Err(e) => {
            let msg_panic = match e.downcast::<String>() { // Renamed msg to msg_panic
              Ok(panic_msg) => format!("{}", panic_msg),
              Err(x) => format!("Unknown Error {:?}", x)
            };
            o_result = DataObject::new();
            o_result.put_string("status", "err");
            o_result.put_string("msg", &msg_panic);
            o_result.put_string("nn_return_type", "500");
          },
        }
      }
      else {
        o_result = DataObject::new();
        o_result.put_string("status", "err");
        let err = format!("UNAUTHORIZED: {}", &cmd);
        o_result.put_string("msg", &err);
        o_result.put_string("nn_return_type", "String");
      }
    }
    else {
      o_result = DataObject::new();
      o_result.put_string("status", "err");
      let err = format!("Unknown command: {}", &cmd);
      o_result.put_string("msg", &err);
      o_result.put_string("nn_return_type", "404");
    }
  }

  if !o_result.has("status") { o_result.put_string("status", "ok"); }
  o_result.set_property("pid", pid); // pid is Data
  o_result
}

fn read_line(reader: &mut TcpStream) -> String {
  let mut buf = [0];
  let mut line: String = "".to_string();
  loop {
    let res = reader.read_exact(&mut buf);
    if res.is_err() { break; }
    line.push(buf[0] as char);
    if buf[0] == b'\r' {
      let res_lf = reader.read_exact(&mut buf); // Renamed res to res_lf
      if res_lf.is_err() { break; }
      line.push(buf[0] as char);
      if buf[0] == b'\n' {
        break;
      }
    }
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
  }
  i
}

pub fn format_result(command:Command, o:DataObject) -> DataObject {
  let mut d_formatted_result; // Renamed d to d_formatted_result

  if command.return_type == "FLAT" {
    if command.lang == "flow" && o.clone().keys().len() > 1 {
      d_formatted_result = o;
    }
    else {
      if o.has("a") { d_formatted_result = o.get_object("a"); }
      else if o.has("data") { d_formatted_result = o.get_object("data"); }
      else { d_formatted_result = o.objects()[0].1.object(); } // This could panic if objects() is empty or not an object
    }
  }
  else {
    d_formatted_result = DataObject::new();
    let oo_data_prop; // Renamed oo to oo_data_prop
    if o.has("a") { oo_data_prop = o.get_property("a"); }
    else if o.has("data") { oo_data_prop = o.get_property("data"); }
    else if o.has("msg") { oo_data_prop = o.get_property("msg"); }
    else { oo_data_prop = o.objects()[0].1.clone(); } // This could panic if objects() is empty

    if command.return_type == "String" {
      d_formatted_result.set_property("msg", oo_data_prop.clone());
    }
    else {
      d_formatted_result.set_property("data", oo_data_prop.clone());
    }
  }

  if !d_formatted_result.has("status") { d_formatted_result.put_string("status", "ok"); }

  d_formatted_result
}
