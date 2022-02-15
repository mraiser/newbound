package com.newbound.net.service.http;

import java.io.*;
import java.net.URL;
import java.net.URLConnection;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Locale;
import java.util.Properties;
import java.util.TimeZone;
import java.util.Vector;

import org.json.JSONObject;

import com.newbound.net.service.ServerSocket;
import com.newbound.net.service.Service;
import com.newbound.net.service.Socket;
import com.newbound.net.tcp.TCPServerSocket;
import com.newbound.robot.BotBase;
import com.newbound.robot.BotManager;
import com.newbound.robot.BotUtil;
import com.newbound.robot.Callback;
import com.newbound.robot.Session;
import com.newbound.net.mime.Base64Coder;
import com.newbound.net.mime.MIMEHeader;
import com.newbound.net.service.App;
import com.newbound.net.service.Container;
import com.newbound.net.service.Parser;
import com.newbound.net.service.ReleaseSocketException;
import com.newbound.net.service.Request;

public class HTTPService extends Service 
{
	private static final long YEARINMILLIS = 365l*24l*60l*60l*1000l;
	private static CORS CORS = null;

	public HTTPService(Container c, int port) throws IOException 
	{
		super(new TCPServerSocket(port), "HTTP", HTTPParser.class, c);
		try
		{
			CORS = new CORS(c.getDefault().getRootDir());
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	private static Hashtable<Thread, Hashtable> REQTHREADS = new Hashtable();
	private static void clearRequestParameters() { REQTHREADS.remove(Thread.currentThread()); }
	private static void setRequestParameters(Hashtable params) { REQTHREADS.put(Thread.currentThread(), params); }
	public static Hashtable getRequestParameters() { return REQTHREADS.get(Thread.currentThread()); }

	@Override
	protected void execute(Object o, Request data, Parser p) throws Exception
	{
		if (callbacks.containsKey(o)) 
		{
			super.execute(o, data, p);
			return;
		}
		
		String cmd = o.toString();
		HTTPRequest req = (HTTPRequest)data;
		HTTPParser parser = (HTTPParser)p;
		
		JSONObject log = req.log;
		CONTAINER.getDefault().fireEvent("HTTP_BEGIN", log);
		long now = System.currentTimeMillis();
		
		Hashtable headers = req.HEADERS;
		Hashtable params = req.PARAMS;
		
		String c = (String)params.get("sessionid");
		if (c == null) c = (String)headers.get("nn-sessionid");
		
		if (c == null) 
		{
			// FIXME - Already happening in request
			c = getHeader(headers, "COOKIE");
			if (c != null)
			{
				String[] cs = c.split("; ");
				for (int x=0; x<cs.length; x++) if (cs[x].startsWith("sessionid="))
				{
					c = cs[x].substring(10);
					break;
				}
			}	
		}
		if (c == null || c.equals("undefined")) c = BotUtil.uniqueSessionID();

		headers.put("nn-sessionid", c);
		
		Session ses = CONTAINER.getDefault().getSession(c, true);
		String loc = req.LOC;
		ses.put("userlocation", loc);
		headers.put("nn-userlocation", loc);
		params.put("sessionid", c);
		params.put("sessionlocation", loc);
		
		o = new JSONObject(headers);
		params.put("request_headers", o.toString());
		params.put("request_input_stream", parser.is);
		params.put("request_output_stream", parser.os);
		
		if (ses.get("user") != null)
		{
			headers.put("nn-username", ses.get("username"));
			headers.put("nn-groups", ((Properties)ses.get("user")).getProperty("groups", "anonymous"));
		}
		else 
		{
			headers.put("nn-username", "anonymous");
			headers.put("nn-groups", "anonymous");
		}
		
		// FIXME - implement or remove
		String trenc = (String)headers.get("TRANSFER-ENCODING");
		if (trenc != null && trenc.equalsIgnoreCase("CHUNKED"))
		{
			System.out.println("CHUNKED");
		}

		String key = (String)headers.get("SEC-WEBSOCKET-KEY");
		if (key != null)
		{
			String defaultbot = ((BotManager)CONTAINER.find("botmanager")).getProperty("defaultbot");
			String bot = defaultbot;
			
			int i = cmd.indexOf("/");
			if (i != -1) 
			{
				bot = cmd.substring(0, i);
				cmd = cmd.substring(i+1);
			}
			
			App b = CONTAINER.find(bot);
			if (b == null) b = CONTAINER.getDefault();
			
			key = key.trim();
			key += "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
			  
			String in = key;
			while (in.length() < 20) in += " ";
			MessageDigest md5 = MessageDigest.getInstance("SHA-1");
			md5.reset();
			md5.update(in.getBytes());
			key = new String(new Base64Coder().encode(md5.digest()));
			
			String response = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n";
			response += "Sec-WebSocket-Accept: " + key.trim()+"\r\n";
			response += "Sec-WebSocket-Protocol: newbound\r\n\r\n";
			
			parser.os.write(response.getBytes());
			parser.os.flush();
			
			Socket con = parser.s;
			b.webSocketConnect(new WebSocket(con), cmd);
			
			// FIXME - make webSocketConnect synchronous and exception becomes unnecessary
			throw new ReleaseSocketException();
		}
		else
		{
			String ka = getHeader(headers, "CONNECTION");

			setRequestParameters(params);
			try
			{
				HTTPResponse response = handleCommand(req.METHOD, headers, params, cmd);
				if (response != null)
				{
					String cl = (String)getHeader(headers, "Content-Length");
					int len = cl == null ? -1 : Integer.parseInt(cl);
					response.KEEPALIVE = len != -1 && ka != null && ka.equalsIgnoreCase("keep-alive");
					parser.send(response);
					if (!response.KEEPALIVE) parser.s.close();
				}
				
				log.put("millis", System.currentTimeMillis()-now);
				log.put("request-type", ""+headers.get("nn-request-type"));
				log.put("response-type", ""+headers.get("nn-response-type"));
				log.put("extension", ""+headers.get("nn-extension"));
				log.put("response-sessionid", ""+headers.get("nn-sessionid"));
				log.put("user", ""+headers.get("nn-username"));
				log.put("groups", ""+headers.get("nn-groups"));
				log.put("userlocation", ""+headers.get("nn-userlocation"));
				CONTAINER.getDefault().fireEvent("HTTP_END", log);
			}
			finally
			{
				clearRequestParameters();
			}
		}
	}
	
	@Override
	public void listen(Socket s, Parser p) throws Exception 
	{
//		s.setSoTimeout(3000);
		super.listen(s, p);
	}

	public HTTPResponse handleCommand(String method, Hashtable headers, Hashtable params, String pathx) throws Exception
	{
		String path = pathx;
		if (path.equals("")) path = CONTAINER.getDefault().getIndexFileName();

		String sessionid = (String)params.get("sessionid");
		String origin = (String)headers.get("ORIGIN");

		Object[] result = { "ok", "" };
		try 
		{
			File f = CONTAINER.extractLocalFile(path);
			String bot = null;

			String cmd = path;
			boolean addindex = cmd.endsWith("/");
			while (cmd.endsWith("/")) cmd =  cmd.substring(0, cmd.length()-1);
			
			int i = cmd.indexOf('/');
			if (i == -1)
			{
				App app = CONTAINER.find(cmd);
				if (f.exists())
				{
					bot = app.getID();
				}
				else if (app != null)
				{
					bot = app.getID();
					cmd = app.getIndexFileName();
					addindex = false;
				}
			}
			else
			{
				bot = cmd.substring(0, i);
				cmd = cmd.substring(i+1);
			}
			
//			String defaultbot = ((BotManager)CONTAINER.find("botmanager")).getProperty("defaultbot");
			String defaultbot = CONTAINER.getDefault().getProperty("defaultbot");

			if (bot == null && pathx.equals("")) 
				return new RedirectResponse("/"+defaultbot+"/"+CONTAINER.getDefault().getIndexFileName());
			
			if (bot == null && cmd.equals("favicon.ico")) 
			{
				bot = defaultbot;
//				cmd = bot+"/favicon.ico";
			}
			
			App a = bot == null ? null : CONTAINER.find(bot);
			
			if (addindex && f.isDirectory()) f = new File(f, a.getIndexFileName());
			if (!f.exists() || !f.isFile()) {
				if (a != null) f = a.extractFile(cmd);
				if (addindex && f.isDirectory()) f = new File(f, a.getIndexFileName());
			}
			
			if (f != null && f.exists() && f.isFile())
			{
				result[0] = "file";
				headers.put("nn-request-type", "file");
				int x = f.getName().lastIndexOf('.');
				headers.put("nn-extension", x == -1 ? "" : f.getName().substring(x+1));
				result[1] = handleFile(f, path, params, headers, origin);
			}
			else
			{
				if (addindex) 
					cmd += "/"+a.getIndexFileName();
				
				URL u;
				if (a != null && (u = a.extractURL(cmd)) != null && !cmd.equals("")) 
				{
//					if (requirePassword()) validateRequest(this, protocol, method, cmd, params, headers, querystring, sock, input);
					result[0] = "file";
					headers.put("nn-request-type", "src");
					int x = u.getPath().lastIndexOf('.');
					headers.put("nn-extension", x == -1 ? "" : u.getPath().substring(x+1));
					result[1] = handleURL(u, path, params, headers, origin);
				}
				else 
				{
					int x = cmd.lastIndexOf('.');
					headers.put("nn-extension", x == -1 ? "" : cmd.substring(x+1));
					headers.put("nn-request-type", "cmd");
					
					if (a == null) a = CONTAINER.getDefault();
					result[1] = a.handleCommand(method, cmd, headers, params);
				}
			}
		}
		catch (Exception404 x)
		{
			File f = CONTAINER.extractLocalFile("404.html");
			if (!f.exists()) f = CONTAINER.getDefault().extractFile("404.html");
			return new ExceptionResponse(404, "Not Found", f);
		}
		catch (Exception x)
		{
			if (!x.getClass().getName().equals("java.lang.Exception")) x.printStackTrace();
			String s = x.getMessage();
			System.out.println("ERROR: "+s);
			result[0] = "err";
			result[1] = ""+s;
		}
		
		headers.put("nn-response-type", result[1] == null ? "NULL"  : result[1].getClass().getName());

		if (result[0].equals("file")) return (HTTPResponse)result[1];
		if (result[1] instanceof HTTPResponse) return (HTTPResponse)result[1];
		if (result[1] instanceof InputStream) return handleContent((InputStream)result[1], params, -1, path, headers, origin);
		if (result[1] instanceof URL) return handleContent(sessionid, headers,(URL)result[1], path, origin);
		
		if (result[1] == null) return null;
		
		if (result[1] instanceof byte[])
		{
			byte[] ba = (byte[])result[1];
			InputStream is = new ByteArrayInputStream(ba);
			return handleContent(is, params, ba.length, path, headers, origin);
		}
		if (result[1] instanceof File)
		{
			File f = (File)result[1];
			if (!f.exists()) 
			{
				f = CONTAINER.extractLocalFile("404.html");
				if (!f.exists()) f = CONTAINER.getDefault().extractFile("404.html");
				return new ExceptionResponse(404, "Not Found", f);
			}
			FileInputStream is = new FileInputStream(f);
			return handleContent(is, params, (int)f.length(), path, headers, origin);
		}
		if (result[1] instanceof Object[])
		{
			Object[] oa = (Object[])result[1];
			if (oa.length == 4) 
				return handleContent(sessionid, path, (InputStream)oa[0], (Integer)oa[1], (String)oa[2], oa[3], origin);
			else 
				return handleContent((InputStream)oa[0], params, (Integer)oa[1], path, headers, origin);
		}

		return buildJSONResponse(path, result, params, origin);
	}

	private InputStream handleFile(File f, String path, Hashtable params, Hashtable headers, String origin) throws Exception
	{
		InputStream is = new BufferedInputStream(new FileInputStream(f));
		return handleContent(is, params, (int)f.length(), path, headers, System.currentTimeMillis()+3600000l, origin);
	}

	private InputStream handleURL(URL u, String path, Hashtable params, Hashtable headers, String origin) throws Exception
	{
		URLConnection uc = u.openConnection(); 
		int len = uc.getContentLength();
		return handleContent(uc.getInputStream(), params, len, path, headers, System.currentTimeMillis()+3600000l, origin);
	}

	private HTTPResponse handleContent(InputStream is, Hashtable paramsx, int len, String name, Hashtable h, String origin) throws Exception
	{
		return handleContent(is, paramsx, len, name, h, -1, origin);
	}
	
	private HTTPResponse handleContent(InputStream is, Hashtable params, int len, String path, Hashtable h, long expires, String origin) throws Exception
	{
		int olen = len;
		int[] range = extractRange(len, h);
		if (range[1] != -1) len = range[1] - range[0] + 1;
		String mimeType = getMIMEType(path);
		String res = range[0] == -1 ? "200 OK" : "206 Partial Content";
		Hashtable outheaders = buildHeaders((String)params.get("sessionid"), path, len, mimeType, range, "bytes", expires, origin);
		HTTPResponse sis = new HTTPResponse(res, outheaders, is, range[0], range[1]);

		return sis;
	}

	public static Hashtable buildHeaders(String sessionid, String name, int len, String mimeType, int[] range, String acceptRanges, long expires, String origin) throws Exception {
		Hashtable h = new Hashtable();
		h.put("Date", toHTTPDate(new Date()));
		if (len != -1) h.put("Content-Length", len);
		if (mimeType != null) h.put("Content-type", mimeType);
		if (acceptRanges != null) h.put("Accept-Ranges", acceptRanges);
		if (range != null && range[0] != -1) h.put("Content-Range","bytes "+range[0]+"-"+range[1]+"/"+range[2]);
		if (expires != -1) h.put("Expires", toHTTPDate(new Date(expires)));
		if (sessionid != null) h.put("Set-Cookie", buildCookie(sessionid));

		if (origin != null)
		{
			String cors = getCORS(name, origin);
			if (cors != null)
			{
				h.put("Access-Control-Allow-Origin", cors);
				if (!cors.equals("*")) h.put("Vary", "Origin");
			}
		}
		return h;
	}

	private static String getCORS(String name, String origin) throws Exception {
		if (CORS != null)
			return CORS.lookup(name, origin);

		return null;
	}

	private HTTPResponse handleContent(String sessionid, String path, InputStream is, int len, String mimeType, Object o, String origin) throws Exception
	{
		Hashtable headers = buildHeaders(sessionid, path, len, mimeType, null, null, -1, origin);
		if (o instanceof String) 
		{
			BufferedReader br = new BufferedReader(new StringReader((String)o));
			String header;
			while ((header = br.readLine()) != null)
			{
				int i = header.indexOf(":");
				if (i != -1)
				{
					String key = header.substring(0, i);
					String val = header.substring(i + 1).trim();
					if (!(key.equals("Set-Cookie") && val.startsWith("sessionid=")))
						headers.put(key, val);
				}
			}
			br.close();
		}
		else
		{
			JSONObject head = (JSONObject)o;
			Iterator<String> i = head.keys();
			while (i.hasNext())
			{
				String key = i.next();
				String val = head.getString(key);
				if (!(key.equals("Set-Cookie") && val.startsWith("sessionid=")))
					headers.put(key, val);
			}
		}
		String res = headers.get("Content-Range") == null ? "200 OK" : "206 Partial Content";
		HTTPResponse sis = new HTTPResponse(path, headers, is, -1, -1);
		return sis;
	}

	private HTTPResponse handleContent(String sessionid, Hashtable h, URL url, String name, String origin) throws Exception
	{
		URLConnection con = url.openConnection();
		int len = con.getContentLength();
		int olen = len;
		int[] range = extractRange(len, h);
		if (range[1] != -1) len = range[1] - range[0] + 1;
		Hashtable headers = buildHeaders(sessionid, name, len, getMIMEType(name), range, "bytes", -1, origin);
		int i = con.getHeaderFields().size();
		while (i-->0)
		{
			String key = con.getHeaderFieldKey(i);
			String val = con.getHeaderField(i);
			if (!(key.equals("Set-Cookie") && val.startsWith("sessionid=")))
				headers.put(key, val);
		}
		
		String mimeType = getMIMEType(name);
		String res = range[0] == -1 ? "200 OK" : "206 Partial Content";
		final InputStream is2 = new ByteArrayInputStream(("HTTP/1.1 "+res+"\r\nAccept-Ranges: bytes"+headers+"\r\n\r\n").getBytes());
		
		HTTPResponse sis = new HTTPResponse(res, headers, con.getInputStream(), range[0], range[1]);
		return sis;
	}

	private String getHeader(Hashtable<String, Object> headers, String string) 
	{
		Object o = headers.get(string.toUpperCase());
		String s;
		if (o instanceof Vector)
		{
			s = (String)((Vector<String>)o).firstElement();
		}
		else s = (String)o;
		
		return s;
	}

	private HTTPResponse buildJSONResponse(String path, Object[] result, Hashtable params, String origin) throws Exception
	{
		String s1 = (String)params.get("callback");
		boolean JSONP = s1 != null;
		if (JSONP) s1 += "(";
		else s1 = "";
		
		if (result[1] instanceof JSONObject)
		{
			s1 += result[1];
		}
		else try
		{
			JSONObject jo = new JSONObject();
			jo.put("status", result[0]);
			jo.put("msg", result[1]);
			s1 += jo.toString();
		}
		catch (Exception x) { x.printStackTrace(); }
		
		if (JSONP) s1 += ")";

		byte[] ba = s1.getBytes();
		Hashtable headers = buildHeaders((String)params.get("sessionid"), path, ba.length, "application/json", null, null, -1, origin);
		return new HTTPResponse("200 OK", headers, new ByteArrayInputStream(ba), -1, -1);
	}

	private static String buildCookie(String sid)
	{
		if (sid == null)
			throw new RuntimeException("NO SESSIONID");

		long l = System.currentTimeMillis()+YEARINMILLIS;
		Date d = new Date(l);
		String c = "sessionid="+sid+"; Path=/; Expires="+toHTTPDate(d);
		return c;
	}

	private int[] extractRange(int len, Hashtable h) 
	{
		int[] out = {-1,-1,len};
		if (h != null) {
			String r = (String)h.get("RANGE");
			if (r != null)
			{
				String[] sa = r.split("-");
				if (!sa[0].equals("")) 
				{
					String[] sa2 = sa[0].split("=");
					out[0] = Integer.parseInt(sa2[1]);
					if (sa.length>1 && !sa[1].equals("")) out[1] = Integer.parseInt(sa[1]);
					else out[1] = len-1;
				}
				else 
				{
					out[0] = 0;
					out[1] = len-1;
				}
			}
		}
		return out;
	}

	public static String getMIMEType(String name)
	{
		String mimeType;
		if (name.endsWith("/")) mimeType = "text/html";
		else mimeType = MIMEHeader.lookupMimeType(name);
		return mimeType;
	}

	public static String toHTTPDate(Date date) 
	{
		SimpleDateFormat formatter = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US);
		formatter.setTimeZone(TimeZone.getTimeZone("GMT"));
        return formatter.format(date);
	}
	
	
	
	

	private static String root(String[] args) throws IOException 
	{
		if (args.length>0) return args[0];
		
		File f = new File(System.getProperty("user.home"));
		File f2 = new File(f, "Desktop");
		
		if (f2.exists() && f2.isDirectory()) return f2.getCanonicalPath()+f.separatorChar;
		return f.getCanonicalPath()+f.separatorChar;
	}
	
	public static void main(String[] args) throws Exception
	{
		final String PREFIX = root(args);
		
		new HTTPService(new Container() 
		{
			Session ses = new Session();
			
			App app = new App() {
				
				@Override
				public void webSocketConnect(WebSocket webSocket, String cmd) throws Exception 
				{
				}
				
				@Override
				public Object handleCommand(String method, String cmd, Hashtable headers, Hashtable params) throws Exception 
				{
					throw new Exception404("Unknown command: "+cmd);
				}
				
				@Override
				public Session getSession(String c, boolean b) 
				{
					return ses;
				}
				
				@Override
				public String getIndexFileName() 
				{
					return "index.html";
				}
				
				@Override
				public String getID() 
				{
					return "newbound";
				}
				
				@Override
				public void fireEvent(String name, JSONObject event) 
				{
					System.out.println(event);
				}
				
				@Override
				public URL extractURL(String cmd) 
				{
					return null;
				}
				
				@Override
				public File extractFile(String cmd) 
				{
					return null;
				}
				
				@Override
				public void addJob(Runnable runnable, String string) 
				{
					new Thread(runnable, string).start();
				}

				@Override
				public boolean running() 
				{
					return true;
				}

				@Override
				public String getProperty(String string) {
					// TODO Auto-generated method stub
					return null;
				}

				@Override
				public File getRootDir() {
					// TODO Auto-generated method stub
					return null;
				}
			};
			
			@Override
			public App getDefault() 
			{
				return app;
			}
			
			@Override
			public App find(String id) 
			{
				return app;
			}
			
			@Override
			public File extractLocalFile(String path) 
			{
				path = PREFIX+path;
				File f = new File(path);
				return f;
			}

			@Override
			public String getLocalID() 
			{
				return null;
			}

			@Override
			public String getMachineID() 
			{
				return null;
			}
		}, 8080);
	}
}



