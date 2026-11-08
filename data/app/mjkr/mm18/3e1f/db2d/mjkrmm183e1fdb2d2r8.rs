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

// Maximum aggregate decoded bytes for one Content-Length or chunked body.
pub const MAX_RAW_BODY: usize = 64 * 1024 * 1024;
pub const MAX_CHUNK_LINE: usize = 4096;
pub const MAX_TRAILER_LINE: usize = 8192;
pub const MAX_TRAILER_BYTES: usize = 64 * 1024;

#[derive(Debug)]
pub struct ChunkedBodyError {
  pub code: i64,
  pub message: String,
}

impl ChunkedBodyError {
  fn bad_request(message: &str) -> Self {
    Self { code: 400, message: message.to_string() }
  }
  fn too_large() -> Self {
    Self { code: 413, message: "Request body exceeds the 64 MiB limit".to_string() }
  }
}

// Read a CRLF-terminated protocol line without accepting a bare LF, EOF, or
// an unbounded line. The delimiter is removed; every other byte is checked
// by the caller. This is deliberately separate from the legacy read_line,
// which is permissive and remains in use by existing MIME handling.
fn read_strict_crlf_line(stream: &mut TcpStream, limit: usize) -> Result<Vec<u8>, ChunkedBodyError> {
  let mut line = Vec::new();
  let mut one = [0u8; 1];
  loop {
    if stream.read_exact(&mut one).is_err() {
      return Err(ChunkedBodyError::bad_request("Truncated chunked request line"));
    }
    if one[0] == b'\n' {
      return Err(ChunkedBodyError::bad_request("Chunked request lines must end with CRLF"));
    }
    if one[0] == b'\r' {
      if stream.read_exact(&mut one).is_err() || one[0] != b'\n' {
        return Err(ChunkedBodyError::bad_request("Chunked request lines must end with CRLF"));
      }
      return Ok(line);
    }
    if line.len() >= limit {
      return Err(ChunkedBodyError::bad_request("Chunked request line is too long"));
    }
    line.push(one[0]);
  }
}

fn valid_token(token: &[u8]) -> bool {
  !token.is_empty() && token.iter().all(|b| matches!(b,
    b'!' | b'#' | b'$' | b'%' | b'&' | b'\'' | b'*' | b'+' | b'-' | b'.' |
    b'^' | b'_' | b'`' | b'|' | b'~' | b'0'..=b'9' | b'A'..=b'Z' | b'a'..=b'z'))
}

fn valid_chunk_extensions(line: &[u8]) -> bool {
  // RFC 9112 chunk-ext: *( ";" token [ "=" ( token / quoted-string ) ] ).
  // Whitespace around the size is intentionally not accepted; a quoted
  // extension value may contain HTAB/SP and the normal qdtext/quoted-pair
  // range, but never controls, CRLF, or an unterminated escape.
  let mut parts = line.splitn(2, |b| *b == b';');
  let size = parts.next().unwrap_or(&[]);
  if size.is_empty() || !size.iter().all(|b| b.is_ascii_hexdigit()) { return false; }
  let extensions = match parts.next() { Some(v) => v, None => return true };
  // splitn removed the semicolon separating size from the first extension.
  // Enter the parser positioned immediately AFTER that delimiter; subsequent
  // delimiters remain in `extensions` and are consumed at the loop bottom.
  let mut i = 0usize;
  while i < extensions.len() {
    let start = i;
    let start = i;
    while i < extensions.len() && extensions[i] != b';' && extensions[i] != b'=' { i += 1; }
    if !valid_token(&extensions[start..i]) { return false; }
    if i < extensions.len() && extensions[i] == b'=' {
      i += 1;
      if i < extensions.len() && extensions[i] == b'"' {
        i += 1;
        let mut closed = false;
        while i < extensions.len() {
          match extensions[i] {
            b'"' => { i += 1; closed = true; break; },
            b'\\' => {
              i += 1;
              if i >= extensions.len() || !matches!(extensions[i], b'\t' | b' '..=b'~' | 0x80..=0xff) { return false; }
              i += 1;
            },
            b'\t' | b' '..=b'!' | b'#'..=b'[' | b']'..=b'~' | 0x80..=0xff => i += 1,
            _ => return false,
          }
        }
        if !closed || (i < extensions.len() && extensions[i] != b';') { return false; }
      }
      else {
        let start = i;
        while i < extensions.len() && extensions[i] != b';' { i += 1; }
        if !valid_token(&extensions[start..i]) { return false; }
      }
    }
    if i < extensions.len() {
      if extensions[i] != b';' { return false; }
      i += 1;
    }
  }
  true
}

fn consume_trailers(stream: &mut TcpStream) -> Result<(), ChunkedBodyError> {
  let mut total = 0usize;
  loop {
    let line = read_strict_crlf_line(stream, MAX_TRAILER_LINE)?;
    if line.is_empty() { return Ok(()); }
    total = total.checked_add(line.len() + 2)
      .ok_or_else(|| ChunkedBodyError::bad_request("Trailer section is too large"))?;
    if total > MAX_TRAILER_BYTES {
      return Err(ChunkedBodyError::bad_request("Trailer section is too large"));
    }
    // No obs-fold or whitespace before the colon. Trailer field values are
    // consumed for framing only and are never exposed as request headers.
    let colon = line.iter().position(|b| *b == b':')
      .ok_or_else(|| ChunkedBodyError::bad_request("Malformed chunk trailer"))?;
    if !valid_token(&line[..colon]) { return Err(ChunkedBodyError::bad_request("Malformed chunk trailer name")); }
    if line[colon + 1..].iter().any(|b| !matches!(b, b'\t' | b' '..=b'~' | 0x80..=0xff)) {
      return Err(ChunkedBodyError::bad_request("Malformed chunk trailer value"));
    }
  }
}

// Decode exactly one chunked message. A successful return means the final
// zero-size chunk, its CRLF, and the complete trailer section were consumed;
// the next unread byte therefore belongs to the next request, if any.
pub fn read_chunked_body(stream: &mut TcpStream, max_body: usize) -> Result<Vec<u8>, ChunkedBodyError> {
  let mut decoded = Vec::new();
  loop {
    let size_line = read_strict_crlf_line(stream, MAX_CHUNK_LINE)?;
    if !valid_chunk_extensions(&size_line) {
      return Err(ChunkedBodyError::bad_request("Malformed chunk size or extension"));
    }
    let size_text = size_line.split(|b| *b == b';').next().unwrap_or(&[]);
    let size_text = std::str::from_utf8(size_text).unwrap_or("");
    let chunk_size = u64::from_str_radix(size_text, 16)
      .map_err(|_| ChunkedBodyError::bad_request("Chunk size is invalid or overflows"))?;
    if chunk_size > max_body as u64 || decoded.len() as u64 + chunk_size > max_body as u64 {
      return Err(ChunkedBodyError::too_large());
    }
    if chunk_size == 0 {
      // The trailer section starts immediately after this size line. When
      // empty, its first blank line supplies the final CRLF.
      consume_trailers(stream)?;
      return Ok(decoded);
    }
    let start = decoded.len();
    decoded.resize(start + chunk_size as usize, 0);
    if stream.read_exact(&mut decoded[start..]).is_err() {
      return Err(ChunkedBodyError::bad_request("Truncated chunk data"));
    }
    let mut crlf = [0u8; 2];
    if stream.read_exact(&mut crlf).is_err() || crlf != *b"\r\n" {
      return Err(ChunkedBodyError::bad_request("Chunk data must be followed by CRLF"));
    }
  }
}

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
        let mut raw_body = DataBytes::from_bytes(&Vec::new());
        let mut request_error = "".to_string();
        let mut request_error_code = 400i64;
        let mut ka_force_close = false;
        let mut chunked_body = false;

        if headers.has("TRANSFER-ENCODING") {
          // HTTP/1.1 chunk framing is decoded before the existing content-type
          // handlers, so JSON POST, form POST, and DAV PUT all receive exactly
          // one decoded body. A declared Content-Length is ignored for chunked
          // messages; chunk bytes, never that stale length, delimit the request.
          let transfer_encoding = headers.get_string("TRANSFER-ENCODING");
          if transfer_encoding.eq_ignore_ascii_case("chunked") {
            match read_chunked_body(&mut stream, MAX_RAW_BODY) {
              Ok(body_buf) => {
                raw_body = DataBytes::from_bytes(&body_buf);
                headers.put_string("CONTENT-LENGTH", &body_buf.len().to_string());
                headers.remove_property("TRANSFER-ENCODING");
                chunked_body = true;
              },
              Err(e) => {
                request_error_code = e.code;
                request_error = e.message;
                // Consume this response only. Never interpret an invalid chunk
                // line, body suffix, or trailer as another HTTP request.
                ka_force_close = true;
              }
            }
          }
          else if !transfer_encoding.eq_ignore_ascii_case("identity") {
            request_error_code = 501;
            request_error = format!("Transfer-Encoding {} is not supported", transfer_encoding);
            // An unsupported coding has no known request boundary. Do not
            // reuse the connection and possibly parse its payload as HTTP.
            ka_force_close = true;
          }
        }

        if method == "POST" && !chunked_body && request_error.is_empty() {
          // A chunked body has already been consumed above and is passed to
          // the command as raw_body. Never read its payload a second time.
          // The legacy Content-Length POST parsers retain their socket path.
          let clstr = headers.try_get_string("CONTENT-LENGTH").unwrap_or_else(|_| "0".to_string());
          let ctstr = match headers.has("CONTENT-TYPE") {
            true => headers.get_string("CONTENT-TYPE"),
            false => "text/plain".to_string()
          };
          let max = match clstr.parse::<usize>() {
            Ok(n) => n,
            Err(_) => {
              request_error = "Invalid Content-Length".to_string();
              ka_force_close = true;
              0
            }
          };
          if max > MAX_RAW_BODY {
            request_error_code = 413;
            request_error = "Request body exceeds the 64 MiB limit".to_string();
            ka_force_close = true;
          }

          let s = ctstr.to_lowercase();
          if request_error.is_empty() && s.contains("application/json") {
            if max > 0 {
                let mut body_buf = vec![0; max];
                match stream.read_exact(&mut body_buf) {
                    Ok(_) => {
                        let body_str = String::from_utf8_lossy(&body_buf).to_string();
                        let json_params = DataObject::from_string(&body_str);
                        params = json_params;
                    },
                    Err(e) => {
                        request_error = format!("Error reading JSON body: {}", e);
                        ka_force_close = true;
                    }
                }
            }
          }
          else if request_error.is_empty() && s.starts_with("multipart/form-data") {
            // MULTIPART
            let boundary = ctstr.split("boundary=").nth(1).map(|s| s.trim_matches('"'));
            if let Some(boundary_str) = boundary {
                let boundary_sep = "--".to_string() + boundary_str;
                let boundary_end = boundary_sep.clone() + "--";

                let mut temp_dir = std::env::temp_dir();
                temp_dir.push("newbound_uploads");
                temp_dir.push(unique_session_id()); // Unique dir per request
                if let Err(e) = fs::create_dir_all(&temp_dir) { 
                    println!("Failed to create temp dir: {}", e);
                    // Continue with empty params
                }

                // Read until first boundary
                loop {
                    let line = read_line(&mut stream);
                    if line.is_empty() { break; } // Stream error
                    if line.trim() == boundary_sep { break; } // Found start
                }

                // Loop over parts
                loop {
                    let part_headers = parse_mime_headers(&mut stream);
                    if !part_headers.has("CONTENT-DISPOSITION") {
                        // Invalid part, probably end of stream
                        break;
                    }

                    let (name, filename_opt) = parse_content_disposition(&part_headers.get_string("CONTENT-DISPOSITION"));
                    if name.is_empty() { continue; } // Skip part with no name

                    let mut part_data: Vec<u8> = Vec::new();
                    let mut is_end = false;

                    // Read part body
                    loop {
                        let line_bytes_res = read_line_as_bytes(&mut stream);
                        if line_bytes_res.is_err() { 
                            is_end = true; // Stream ended unexpectedly
                            break; 
                        }
                        let line_bytes = line_bytes_res.unwrap();
                        
                        // Check if this line is a boundary
                        let line_trimmed = trim_bytes_crlf(&line_bytes); // Trim only \r\n
                        
                        if line_trimmed == boundary_sep.as_bytes() {
                            break; // End of this part
                        }
                        if line_trimmed == boundary_end.as_bytes() {
                            is_end = true;
                            break; // End of all parts
                        }
                        
                        // Not a boundary, add to data
                        part_data.extend_from_slice(&line_bytes);
                    }
                    
                    // We read one line too many (the boundary). The *actual* data
                    // ends before the \r\n of the *previous* line.
                    if part_data.ends_with(b"\r\n") {
                        part_data.truncate(part_data.len() - 2);
                    }

                    // Process the data
                    if let Some(filename) = filename_opt {
                        if !filename.is_empty() {
                            // It's a file
                            let temp_path = temp_dir.join(&filename);
                            if let Err(e) = fs::write(&temp_path, &part_data) { // Pass part_data by ref
                                println!("Failed to write temp file: {}", e);
                            } else {
                                params.put_string(&name, temp_path.to_str().unwrap_or(""));
                            }
                        } else {
                             // Field with an empty filename, treat as text
                             params.put_string(&name, &String::from_utf8_lossy(&part_data));
                        }
                    } else {
                        // It's form data
                        params.put_string(&name, &String::from_utf8_lossy(&part_data));
                    }

                    if is_end { break; }
                }

                // Cleanup temp dir
                if let Err(e) = fs::remove_dir_all(&temp_dir) {
                    println!("Failed to clean temp dir: {}", e);
                }

            } else {
                println!("Multipart request without boundary!");
            }
          }
          else if request_error.is_empty() {
            // DEFAULT: Handle application/x-www-form-urlencoded
            let mut max_i64 = max as i64; // Use i64 for compatibility with old logic
            while max_i64 > 0 {
              let mut b_post = false; // Renamed b to b_post
              let mut buf = vec![];
              let n = read_until(&mut stream, b'=', &mut buf);
              max_i64 -= n as i64;
              let mut key = String::from_utf8_lossy(&buf).to_string();
              if key.ends_with("=") {
                key = (&key[..n-1]).to_string();
              }

              buf = vec![];
              let n_val = read_until(&mut stream, b'&', &mut buf); // Renamed n to n_val
              max_i64 -= n_val as i64;
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

        else if method != "GET" && method != "HEAD" && !chunked_body {
          // Chunked bodies of every method were already consumed above.
          // Preserve arbitrary non-POST request bodies (WebDAV PUT/PROPFIND,
          // JSON PATCH, etc.) without decoding or newline transformation.
          // Consume or reject the body on every path so keep-alive stays framed.
          let content_length = headers.try_get_string("CONTENT-LENGTH").unwrap_or_else(|_| "0".to_string());
          let body_len = match content_length.parse::<usize>() {
            Ok(n) => n,
            Err(_) => {
              request_error = "Invalid Content-Length".to_string();
              ka_force_close = true;
              0
            }
          };
          if request_error.is_empty() && body_len > MAX_RAW_BODY {
            request_error_code = 413;
            request_error = "Request body exceeds the 64 MiB limit".to_string();
            // The oversized payload is still on the socket. Do not consume
            // part of it and mistake its remainder for another request.
            ka_force_close = true;
          }
          if request_error.is_empty() && body_len > 0 {
            let mut body_buf = vec![0; body_len];
            match stream.read_exact(&mut body_buf) {
              Ok(_) => raw_body = DataBytes::from_bytes(&body_buf),
              Err(e) => {
                request_error = format!("Error reading request body: {}", e);
                ka_force_close = true;
              }
            }
          }
        }

        // Chunked JSON POST was decoded above, before the legacy POST branch.
        // Populate command params here, exactly as the Content-Length JSON
        // branch does, rather than delivering only raw_body and losing fields.
        // Invalid UTF-8/JSON becomes a framed 400, not a listener-thread panic.
        if method == "POST" && chunked_body && request_error.is_empty() {
          let content_type = headers.try_get_string("CONTENT-TYPE").unwrap_or_else(|_| "text/plain".to_string());
          if content_type.to_lowercase().contains("application/json") {
            match String::from_utf8(raw_body.get_data()) {
              Ok(body_text) => {
                match DataObject::try_from_string(&format!("{{\"body\":{}}}", body_text)) {
                  Ok(wrapper) => {
                    let body_data = wrapper.get_property("body");
                    if body_data.is_object() { params = body_data.object(); }
                    else { request_error = "JSON request body must be an object".to_string(); }
                  },
                  Err(_) => { request_error = "Invalid JSON request body".to_string(); }
                }
              },
              Err(_) => { request_error = "JSON request body is not UTF-8".to_string(); }
            }
            if !request_error.is_empty() {
              request_error_code = 400;
              ka_force_close = true;
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

        //if headers.has("HOST"){
        //  let h = headers.get_string("HOST");
        //  request.put_string("host", &h);
        //}
        request.put_string("host", &headers.try_get_string("HOST").unwrap_or("".to_string()));

        //if headers.has("REFERER"){
        //  let h = headers.get_string("REFERER");
        //  request.put_string("referer", &h);
        //}
        request.put_string("referer", &headers.try_get_string("REFERER").unwrap_or("".to_string()));
        
        request.put_string("protocol", &protocol);
        request.put_string("path", &cmd_path);
        request.put_string("loc", &loc);
        request.put_string("method", &method);
        request.put_string("querystring", &querystring);
        request.put_object("headers", headers.clone()); // Clone headers before moving to request
        request.put_object("params", params);
        request.put_bytes("body", raw_body);
        if !request_error.is_empty() {
          request.put_string("request_error", &request_error);
          request.put_int("request_error_code", request_error_code);
        }

        let now = time();
        request.put_int("timestamp", now);

        fire_event("app", "HTTP_BEGIN", request.clone());

        let mut ka;
        if headers.has("CONNECTION") { ka = headers.get_string("CONNECTION"); }
        else { ka = "close".to_string(); }
        if ka_force_close { ka = "close".to_string(); }

        let mut response_obj = DataObject::new(); // Renamed response to response_obj to avoid conflict
        let dataref = response_obj.data_ref;

        let result = panic::catch_unwind(|| {
          let mut p = DataObject::get(dataref);
          if !request_error.is_empty() {
            let mut o = DataObject::new();
            o.put_int("code", request_error_code);
            o.put_string("msg", "BAD REQUEST");
            o.put_string("mimetype", "text/plain; charset=utf-8");
            o.put_string("body", &request_error);
            p.put_object("a", o);
          }
          else {
            let o = handle_request(request.clone(), stream.try_clone().unwrap());
            p.put_object("a", o);
          }
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
          // Every response advertises whether its connection can be reused.
          // HEAD retains the equivalent GET length but suppresses every body
          // representation below: regular files, byte streams, and strings.
          response_headers.put_string("Connection", &ka);

          // Request-framing errors are answered before handle_request creates
          // or refreshes a session. Do not panic trying to emit a session
          // cookie on that early-error path: the promised 400/413 response
          // must still reach the client and the connection must then close.
          if request.has("session") && request.get_property("session").is_object() {
            let session = request.get_object("session");
            if session.has("id") && session.get_property("id").is_string() {
              let session_id_cookie = session.get_string("id");
              let later = now + 31536000000;
              let cookie = "sessionid=".to_string() + &session_id_cookie + "; Path=/; Expires=" + &RFC2822Date::new(later).to_string();
              response_headers.put_string("Set-Cookie", &cookie);
            }
          }

          let cors = "*";
          response_headers.put_string("Access-Control-Allow-Origin", cors);

          let mut reshead = "HTTP/1.1 ".to_string() + &code.to_string() + " " + &msg + "\r\n";
          for (k,v) in response_headers.objects() {
            reshead = reshead + &k + ": " + &Data::as_string(v) + "\r\n";
          }
          reshead = reshead + "\r\n";

          if method == "HEAD" {
            let _x = stream.write(reshead.as_bytes());
          }
          else if isfile {
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
  // An ordinary HTTP request must retain the session prepared above for its
  // response cookie. Do not move a headers handle out of the request record.
  let is_websocket = {
    let headers = request.get_object("headers");
    headers.has("SEC-WEBSOCKET-KEY")
  };
  if !is_websocket { return false; }
  let headers = request.get_object("headers");

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
        //println!("BAD WEBSOCK NO GOOD");
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
                // set_property stores the Data value. Clone it so the
                // temporary iterator value cannot make a later GC collect
                // the request's session/headers while this same connection
                // is still serializing its response.
                params_clone.set_property(&("nn_".to_string()+&k), v.clone());
              }

              let d_result = handle_command(d_cmd, session_id.to_owned()); // Renamed d to d_result
              let r_type = d_result.get_string("nn_return_type"); // Renamed r to r_type
              if r_type != "404" {
                b_found = true;
                // Explicit opt-in for protocol adapters (WebDAV, webhooks,
                // etc.). Ordinary command responses retain their JSON shape.
                if r_type == "FLAT" && d_result.has("nn_http") && d_result.get_boolean("nn_http") {
                  res = d_result;
                }
                else if cmd == "dav" && d_result.has("status") && d_result.get_string("status") == "err" && d_result.has("msg") && d_result.get_string("msg").starts_with("UNAUTHORIZED:") {
                  // Protocol clients need an HTTP denial, not a JSON error in a 200.
                  res.put_int("code", 403);
                  res.put_string("msg", "FORBIDDEN");
                  res.put_string("mimetype", "text/plain; charset=utf-8");
                  res.put_string("body", "Forbidden");
                }
                else if r_type == "File" {
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

pub fn handle_command_parity_host(d: DataObject, sid: String) -> DataObject {
  handle_command(d, sid)
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
        let response_container = DataObject::new(); // Renamed response to response_container
        let dataref = response_container.data_ref;
        let r_return_type = command.return_type.to_owned(); // Renamed r to r_return_type

        let result = panic::catch_unwind(|| {
          let mut p_response_target = DataObject::get(dataref); // Renamed p to p_response_target
          // Arguments that do not fit the declared types, and a failed flow, are error
          // results ({status: "err", msg, ...}), not panics.
          if let Err(m) = command.try_cast_params(params.clone()) {
            let mut e = DataObject::new();
            e.put_string("status", "err");
            e.put_string("msg", &m);
            p_response_target.put_object("err", e);
            return;
          }
          match command.execute(params) {
            Ok(cmd_output) => p_response_target.put_object("a", cmd_output), // Renamed o to cmd_output
            // A failed flow: what failed and where, with the details under flow_error.
            Err(e) => p_response_target.put_object("err", e.to_envelope()),
          }
        });

        match result {
          Ok(_x) if response_container.has("err") => {
            o_result = response_container.get_object("err");
            o_result.put_string("nn_return_type", "500");
          },
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

// Helper function to read a line as raw bytes (including \r\n)
fn read_line_as_bytes(reader: &mut TcpStream) -> std::io::Result<Vec<u8>> {
    let mut buf = [0];
    let mut line: Vec<u8> = Vec::new();
    loop {
        match reader.read_exact(&mut buf) {
            Ok(_) => {
                line.push(buf[0]); // PUSH THE BYTE
                if buf[0] == b'\n' {
                    break; // Found \n
                }
            },
            Err(e) => return if line.is_empty() { Err(e) } else { Ok(line) } // Return partial line on EOF
        }
    }
    Ok(line)
}

pub fn format_result(command:Command, o:DataObject) -> DataObject {
  let mut d_formatted_result; // Renamed d to d_formatted_result

  if o.has("status") && o.get_string("status") == "err" {
      d_formatted_result = o;
  }
  else if command.return_type == "FLAT" {
    if command.lang == "flow" && o.clone().keys().len() > 1 {
      d_formatted_result = o;
    }
    else {
      if o.has("a") { d_formatted_result = o.get_object("a"); }
      else if o.has("data") { d_formatted_result = o.get_object("data"); }
      else if o.clone().keys().is_empty() { d_formatted_result = o; } // nothing delivered (e.g. a flow that terminated before any output): {status:ok}, not an index panic
      else { d_formatted_result = o.objects()[0].1.object(); } // panics if the only value is not an object
    }
  }
  else {
    d_formatted_result = DataObject::new();
    let oo_data_prop; // Renamed oo to oo_data_prop
    if o.has("a") { oo_data_prop = o.get_property("a"); }
    else if o.has("data") { oo_data_prop = o.get_property("data"); }
    else if o.has("msg") { oo_data_prop = o.get_property("msg"); }
    else if o.clone().keys().is_empty() { oo_data_prop = Data::DNull; } // nothing delivered (e.g. a flow that terminated before any output): data null, not an index panic
    else if command.lang == "flow" && o.clone().keys().len() > 1 { oo_data_prop = Data::DObject(o.data_ref); } // a multi-output flow: the whole result, never one key picked in HashMap order
    else { oo_data_prop = o.objects()[0].1.clone(); }

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

// Helper to parse MIME part headers
fn parse_mime_headers(stream: &mut TcpStream) -> DataObject {
    let mut headers = DataObject::new();
    let mut last_key = "".to_string();
    loop {
        let line = read_line(stream); // read_line returns String, strips \r\n
        if line.trim().is_empty() {
            break; // End of headers
        }
        if line.starts_with(' ') || line.starts_with('\t') {
            // Multi-line header
            if !last_key.is_empty() {
                let old_val = headers.get_string(&last_key);
                headers.put_string(&last_key, &(old_val + "\r\n" + line.trim()));
            }
        } else {
            if let Some(idx) = line.find(':') {
                let key = line[..idx].to_uppercase().trim().to_string();
                let val = line[idx+1..].trim().to_string();
                headers.put_string(&key, &val);
                last_key = key;
            }
        }
    }
    headers
}

// Helper to parse Content-Disposition header
fn parse_content_disposition(disp: &str) -> (String, Option<String>) {
    let mut name = "".to_string();
    let mut filename = None;
    for part in disp.split(';') {
        let part = part.trim();
        if part.starts_with("name=\"") {
            name = part[6..part.len()-1].to_string();
        } else if part.starts_with("filename=\"") {
            filename = Some(part[10..part.len()-1].to_string());
        }
    }
    (name, filename)
}

// Helper to trim \r\n from the end of a byte slice
fn trim_bytes_crlf(bytes: &[u8]) -> &[u8] {
    let mut end = bytes.len();
    if end > 0 && bytes[end - 1] == b'\n' {
        end -= 1;
    }
    if end > 0 && bytes[end - 1] == b'\r' {
        end -= 1;
    }
    &bytes[..end]