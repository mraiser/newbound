use ndata::dataobject::*;
use std::io::prelude::*;
use std::net::TcpListener;
use std::thread;
use std::panic;
use std::fs;
use std::path::Path;
use std::fs::metadata;
use ndata::dataarray::*;
use std::net::TcpStream;
use ndata::data::Data;

use flowlang::command::*;
use flowlang::datastore::*;
use flowlang::rfc2822date::*;
use flowlang::sha1::*;
use flowlang::base64::*;

use flowlang::generated::flowlang::http::hex_decode::hex_decode;
use flowlang::generated::flowlang::system::time::time;
use flowlang::generated::flowlang::file::mime_type::*;
use flowlang::generated::flowlang::system::unique_session_id::*;

pub fn http_listen() {
  let system = DataStore::globals().get_object("system");
  let socket_address = system.get_string("socket_address");

  let listener = TcpListener::bind(socket_address).unwrap();
  for stream in listener.incoming() {
    let mut stream = stream.unwrap();
    thread::spawn(move || {
      let remote_addr = stream.peer_addr().unwrap();
      let mut line = read_line(&mut stream);
      let mut count = line.len();
      if count > 2 {
        line = (&line[0..count-2]).to_string();
        count = line.find(" ").unwrap();
        let method = (&line[0..count]).to_string();
        line = (&line[count+1..]).to_string();
        count = line.find(" ").unwrap();
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
              headers.put_str(&key, &val);
            }
            else {
              let d = headers.get_property(&key);
              if d.is_array() {
                d.array().push_str(&val);
              }
              else {
                let old = d.string();
                let mut v = DataArray::new();
                v.push_str(&old);
                v.push_str(&val);
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
              v.push_str(&old);
            }
            else {
              let mut old = d.string();
              old = old + "\r\n" + line.trim_end();
              headers.put_str(&last, &old);
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

              params.put_str(&key, &value);
              
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
              params.put_str(&key, &value);
            }
          }
        }
        else {
          cmd = path;
        }
        let loc = remote_addr.to_string();
        headers.put_str("nn-userlocation", &loc);
        let mut request = DataObject::new();

        // FIXME - Is this necessary?
        if headers.has("ACCEPT-LANGUAGE"){ 
          let lang = headers.get_string("ACCEPT-LANGUAGE");
          request.put_str("language", &lang);
        }
        else {
          request.put_str("language", "*");
        }

        // FIXME - Is this necessary?
        if headers.has("HOST"){ 
          let h = headers.get_string("HOST");
          request.put_str("host", &h);
        }

        // FIXME - Is this necessary?
        if headers.has("REFERER"){ 
          let h = headers.get_string("REFERER");
          request.put_str("referer", &h);
        }

        request.put_str("protocol", &protocol);
        request.put_str("path", &cmd);
        request.put_str("loc", &loc);
        request.put_str("method", &method);
        request.put_str("querystring", &querystring);
        request.put_object("headers", headers.duplicate());
        request.put_object("params", params);
        request.put_i64("timestamp", time());

        // FIXME
    //		CONTAINER.getDefault().fireEvent("HTTP_BEGIN", log);

        // FIXME - implement or remove
        if headers.has("TRANSFER-ENCODING"){
          let trenc = headers.get_string("TRANSFER-ENCODING");
          if trenc.to_uppercase() == "CHUNKED" {
            // CHUNKED
          }
        }

        
        // FIXME - Implement keep-alive
  //      let mut ka = "close".to_string();
  //      if headers.has("CONNECTION") { ka = headers.get_string("CONNECTION"); }

        // FIXME - origin is never used, impliment CORS
  //      let mut origin = "null".to_string();
  //      if headers.has("ORIGIN") { origin = headers.get_string("ORIGIN"); }

        let mut response = DataObject::new();
        let dataref = response.data_ref;

        let result = panic::catch_unwind(|| {
          let mut p = DataObject::get(dataref);
          let o = handle_request(request, stream.try_clone().unwrap());
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
            o.put_str("body", &s);
            o.put_i64("code", 500);
            o.put_str("mimetype", "text/html");
            response.put_object("a", o);
          }
        }
          
        if !headers.has("SEC-WEBSOCKET-KEY") {
          let response = response.get_object("a").duplicate();

          let body:String;
          let mimetype:String;
          let len:i64;
          let code:u16;
          let msg:String;
          let mut headers:DataObject;
          
          let isfile = response.has("file") && response.get_property("file").is_string();
          
          if isfile { body = response.get_string("file"); }
          else if response.has("body") && response.get_property("body").is_string() { body = response.get_string("body"); }
          else { body = "".to_owned(); }

          if response.has("code") && response.get_property("code").is_int() { code = response.get_i64("code") as u16; }
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

          if response.has("len") && response.get_property("len").is_int() { len = response.get_i64("len"); }
          else if headers.has("Content-Length") { len = headers.get_i64("Content-Length"); }
          else if isfile { len = fs::metadata(&body).unwrap().len() as i64; }
          else { len = body.len() as i64; }

          //FIXME
    //		int[] range = extractRange(len, h);
    //		if (range[1] != -1) len = range[1] - range[0] + 1;
    //		String res = range[0] == -1 ? "200 OK" : "206 Partial Content";

          let date = RFC2822Date::now().to_string();

          headers.put_str("Date", &date);
          headers.put_str("Content-Type", &mimetype);
          if len != -1 { headers.put_str("Content-Length", &len.to_string()); }
          // FIXME
    //      if (acceptRanges != null) h.put("Accept-Ranges", acceptRanges);
    //      if (range != null && range[0] != -1) h.put("Content-Range","bytes "+range[0]+"-"+range[1]+"/"+range[2]);
    //      if (expires != -1) h.put("Expires", toHTTPDate(new Date(expires)));

    //      let later = now.add(Duration::weeks(52));
    //      let cookie = "sessionid=".to_string()+&sid+"; Path=/; Expires="+&later.to_rfc2822();
    //      headers.put_str("Set-Cookie", &cookie);

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
            stream.write(reshead.as_bytes()).unwrap();
            let mut file = fs::File::open(&body).unwrap();
            let chunk_size = 0x4000;
            loop {
              let mut chunk = Vec::with_capacity(chunk_size);
              let n = std::io::Read::by_ref(&mut file).take(chunk_size as u64).read_to_end(&mut chunk).unwrap();
              if n == 0 { break; }
              stream.write(&chunk).unwrap();
              if n < chunk_size { break; }
            }
          }
          else {
            let response = reshead + &body;
            stream.write(response.as_bytes()).unwrap();
          }
          stream.flush().unwrap();
        }
      }
      // FIXME
  //				CONTAINER.getDefault().fireEvent("HTTP_END", log);

      DataStore::gc();
    });
  }
}

fn handle_request(mut request: DataObject, mut stream: TcpStream) -> DataObject {
  let system = DataStore::globals().get_object("system");

  let path = hex_decode(request.get_string("path"));
  let mut params = request.get_object("params");
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
  
  let mut sessions = system.get_object("sessions");
  let mut session;
  if !sessions.has(&session_id) {
    session = DataObject::new();
    session.put_i64("count", 0);
    session.put_str("id", &session_id);
    sessions.put_object(&session_id, session.duplicate());
  }
  else {
    session = sessions.get_object(&session_id);
  }
  
  let session_timeout;
  if system.has("sessiontimeoutmillis") { 
    let d = system.get_property("sessiontimeoutmillis");
    if d.is_int() { session_timeout = d.int(); }
    else { 
      session_timeout = d.string().parse::<i64>().unwrap(); 
      system.duplicate().put_i64("sessiontimeoutmillis", session_timeout);
    }
  }
  else { 
    session_timeout = 900000; 
    system.duplicate().put_i64("sessiontimeoutmillis", session_timeout);
  }
  
  let expire = time() + session_timeout;
  session.put_i64("expire", expire);
  
  let count = session.get_i64("count") + 1;
  session.put_i64("count", count);
  
  if session.has("user") {
    headers.put_str("nn-username", &session.get_string("username"));
    let groups = session.get_object("user").get_string("groups");
    headers.put_str("nn-groups", &groups);
  }
  else {
    headers.put_str("nn-username", "anonymous");
    headers.put_str("nn-groups", "anonymous");
  }
  
  request.put_object("session", session);
  
  let mut res = DataObject::new();
  
  let mut p = "html".to_string() + &path;
  let mut b = false;
  
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
    res.put_str("file", &p);
    res.put_str("mimetype", &mime_type(p));
  }
  else if path == "/" {
    let default_app = system.get_string("default_app");
    let p = "/".to_owned()+&default_app+"/index.html";
    res.put_i64("code", 302);
    res.put_str("msg", "FOUND");
    let mut h = DataObject::new();
    h.put_str("Location", &p);
    res.put_object("headers", h);
  }
  else {
    if headers.has("SEC-WEBSOCKET-KEY") {
      b = true;
      
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
      
      loop {
        if !system.get_bool("running") { break; }
        
        let base:i64 = 2;
        let pow7 = base.pow(7);
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
          else if opcode == 8 {  return DataObject::new(); } // panic!("Websocket closed"); } 
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

        let msg = std::str::from_utf8(&baos).unwrap().to_owned();        
        
        let system = system.duplicate();
        let mut stream = stream.try_clone().unwrap();
        let request = request.duplicate();
        
        thread::spawn(move || {
          if msg.starts_with("cmd ") {
            let msg = &msg[4..];
            let d = DataObject::from_string(msg);
            let app = d.get_string("bot");
            let cmd = d.get_string("cmd");
            let pid = d.get_string("pid");
            let mut params = d.get_object("params");
            
            for (k,v) in request.objects() {
              if k != "params" {
                params.set_property(&("nn-".to_string()+&k), v);
              }
            }
            
            let (b, ctldb, id) = lookup_command_id(system.duplicate(), app, cmd.to_owned());
            
            let mut o;
            if b {
              let command = Command::new(&ctldb, &id);
              o = command.execute(params).unwrap();
              o = format_result(command, o);
            }
            else {
              o = DataObject::new();
              o.put_str("status", "err");
              let err = format!("Unknown websocket command; {}", &cmd);
              o.put_str("msg", &err);
            }
            
            if !o.has("status") { o.put_str("status", "ok"); }
            o.put_str("pid", &pid);
            
            let msg = o.to_string();
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

            let _ = stream.write(&reply).unwrap();
          }
        });
      }
    }
    else {
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
          a.push_str(s);
        }
        if a.len() == 0 { a.push_str("index.html"); }
        
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
          res.put_str("file", &p);
          res.put_str("mimetype", &mime_type(p));
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
            res.put_str("file", &p);
            res.put_str("mimetype", &mime_type(p));
          }
          else {
            // try app command
            let (bb, ctldb, id) = lookup_command_id(system.duplicate(), appname, cmd.to_owned());
            if bb {
              b = true;
              
              let command = Command::new(&ctldb, &id);
              command.cast_params(params.duplicate());
              for (k,v) in request.objects() {
                if k != "params" {
                  params.set_property(&("nn-".to_string()+&k), v);
                }
              }
              
              let r = command.return_type.to_owned();
              let o = command.execute(params.duplicate()).unwrap();
              let d = format_result(command, o);
              if r == "File" {
                res.put_str("file", &d.get_string("data"));
                res.put_str("mimetype", &mime_type(p));
              }
              else {
                let s;
                if params.has("callback") {
                  s = params.get_string("callback") + "(" + &d.to_string() + ")";
                }
                else {
                  s = d.to_string();
                }
                res.put_str("body", &s);
                res.put_str("mimetype", "application/json");
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
        res.put_str("file", &p);
        res.put_str("mimetype", "text/html");
      }
      res.put_i64("code", 404);
      res.put_str("msg", "NOT FOUND");
    }
  }

  res
}

fn format_result(command:Command, o:DataObject) -> DataObject {
  let mut d;
                
  if command.return_type == "FLAT" { 
    if command.lang == "flow" && o.duplicate().keys().len() > 1 {
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
  
  if !d.has("status") { d.put_str("status", "ok"); }
  
  d
}

fn lookup_command_id(system: DataObject, app:String, cmd: String) -> (bool, String, String) {
  let mut b = false;
  let mut ctldb = "".to_string();
  let mut id = "".to_string();
  let apps = system.get_object("apps");
  if apps.has(&app) {
    let appdata = apps.get_object(&app).get_object("app");
    ctldb = appdata.get_string("ctldb");
    let ctlid = appdata.get_string("ctlid");
    let store = DataStore::new();
    let ctllist = store.get_data(&ctldb, &ctlid).get_object("data").get_array("cmd");
    for ctl in ctllist.objects() {
      let ctl = ctl.object();
      let name = ctl.get_string("name");
      if name == cmd {
        b = true;
        id = ctl.get_string("id");
        break;
      }
    }
  }
  (b, ctldb, id)
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

