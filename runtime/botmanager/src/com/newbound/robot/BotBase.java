package com.newbound.robot;

// https://datatracker.ietf.org/doc/html/rfc6455

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.net.URI;
import java.net.URL;
import java.nio.channels.SocketChannel;
import java.security.KeyPair;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Properties;
import java.util.Vector;

import com.newbound.code.Code;
import com.newbound.net.mime.Base64Coder;
import com.newbound.net.service.http.Exception404;
import com.newbound.p2p.P2PPeer;
import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.crypto.SuperSimpleCipher;
import com.newbound.net.service.App;
import com.newbound.net.service.Container;
import com.newbound.net.service.Socket;
import com.newbound.net.service.http.HTTPService;
import com.newbound.net.service.http.WebSocket;
import com.newbound.p2p.P2PCallback;
import com.newbound.p2p.P2PCommand;
import com.newbound.p2p.P2PConnection;
import com.newbound.thread.PeriodicTask;
import com.newbound.thread.ThreadHandler;
import com.newbound.util.IsRunning;
import com.newbound.util.NoDotFilter;

public abstract class BotBase extends BotUtil implements Container, App //ChannelOwner, ServiceManager
{
	private static final int NUMHTTPTHREADS = 10;
	
//	public abstract Object handleCommand(String cmd, Hashtable params) throws Exception;
//	public abstract JSONObject getCommands() throws Exception;
	public abstract String getServiceName();

    protected Properties PROPERTIES = null;
    protected Properties APPPROPERTIES = null;
	protected File ROOT = null;
	protected boolean RUNNING = false;
	protected boolean OFF = true;
    protected Vector<Socket> websockets = new Vector();
    
    protected static Hashtable<String, Hashtable> sessions = new Hashtable();
    protected static Object[] zeroconf = null;
	protected static Hashtable mZeroConfServices = new Hashtable();
	protected static Hashtable<String, BotBase> mBots = new Hashtable();
	protected static BotBase mMasterBot = null;
	
	static final long sessiontimeout = 900000l; // 15 minutes
	private static final long sessioncheckinterval = 10000; // 10 seconds

	private boolean launchbrowser = true;
	
	private ThreadHandler mThreadHandler = null;

	public static HTTPService HTTP;

	// Originally from MetaBot
	protected final Hashtable<String, Object> RUNTIME = new Hashtable();

	private static final int NUMMETABOTTHREADS = 5;
	private static Runnable UPDATETHREAD = null;
	private static Vector<String> REBUILT = new Vector<>();

//	private long UPDATEMILLIS = 5l * 60l * 1000l;

	public abstract String DB();
	public abstract String ID();
//	protected String DB = "taskbot";
//	protected String ID = "rjvxkn1594bc321c2r2";
//	protected String[] LIBRARIES = {};

	public void sendBytesThroughRelay(String mRelay, String mPeer, byte[] data) throws IOException
    {
    	throw new IOException("Not implemented");
    }
    
	protected void sessionChecker()
	{
		sessions = new Hashtable();
		
				System.out.println("Session checking starting up");
				while (RUNNING) try
				{
					Thread.sleep(sessioncheckinterval);
					Vector v = new Vector();
					Enumeration e = sessions.keys();
					long now = System.currentTimeMillis();
					while (e.hasMoreElements())
					{
						String sid = (String)e.nextElement();
						Session ses = (Session)sessions.get(sid);
						if (ses.expire < now) v.addElement(sid);
					}
					e = v.elements();
					while (e.hasMoreElements()) 
					{
						String sid = (String)e.nextElement();
						System.out.println("Session expired: "+sid);
						sessions.remove(sid);
					}
				}
				catch (Exception x) { x.printStackTrace(); }
				System.out.println("Session checking stopped");
			}

	public BotBase resolveBot(String cmd)
	{
		return this;
	}

	public void init() throws Exception
	{
		mThreadHandler = new ThreadHandler(getServiceName());
		mThreadHandler.init(getRootDir());

		if (ROOT == null) ROOT = getRootDir();
    	ROOT.mkdirs();
//    	deleteDir(newTempFile().getParentFile());
    	
		try
		{
			loadBotProperties();
			File f = new File(getRootDir(), "app.properties");
			if (!f.exists())
			{
				Properties p = new Properties();
				p.setProperty("id", getServiceName());
				p.setProperty("name", getServiceName());
				p.setProperty("desc", "The "+getServiceName()+" application");
				p.setProperty("img", "/botmanager/img/nslcms.png");
				p.setProperty("botclass", getClass().getCanonicalName());
				p.setProperty("price", "0.00");
				p.setProperty("version", "1");
				FileOutputStream fos = new FileOutputStream(f);
				p.store(fos, "");
				fos.flush();
				fos.close();
				
				APPPROPERTIES = p;
			}
			else APPPROPERTIES = loadProperties(f);
	}
		catch (Exception x) { x.printStackTrace(); }
		
		if (PROPERTIES.getProperty("machineid") == null) try
		{
			PROPERTIES.setProperty("machineid", InetAddress.getLocalHost().getHostName().replace('.', '_'));
			saveSettings();
		}
		catch (Exception x) 
		{ 
//			x.printStackTrace();
			PROPERTIES.setProperty("machineid", "mydevice");
			saveSettings();
		}
		
		if (PROPERTIES.getProperty("portnum") == null) try
		{
			PROPERTIES.setProperty("portnum", ""+getDefaultPortNum());
			saveSettings();
		}
		catch (Exception x) { x.printStackTrace(); }

		// Originally from MetaBot
		addNumThreads(1); // Everybody gets one

		File tempdir = newTempFile();

		JSONObject jo = app(getServiceName());
		JSONArray libraries = jo.getJSONArray("libraries");
		int i = libraries.length();
		while (i-->0) try
		{
			String lib = libraries.getString(i);
			JSONObject DATA = getData(lib, "tasklists").getJSONObject("data");
			if (REBUILT.indexOf(lib) == -1) {
				REBUILT.add(lib);
				rebuildLibrary(lib);
				startEvents(lib);
				startTimers(lib);
			}
		}
		catch (Exception x)
		{
			x.printStackTrace();
		}

//		recompile();

		if (tempdir != null) deleteDir(tempdir);
	}

	protected void loadBotProperties() throws IOException
	{
		PROPERTIES = new Properties();
		File f = new File(getRootDir(), "botd.properties");
		if (f.exists())
		{
			FileInputStream fis = new FileInputStream(f);
			PROPERTIES.load(fis);
			fis.close();
		}
	}

	public int getVersion()
	{
		return Integer.parseInt(APPPROPERTIES.getProperty("version"));
	}
	
	public static boolean isConnected(String uuid) throws Exception 
	{
		//FIXME!!!
		BotBase b = getBot("peerbot");
		if (b == null) return false;
		
		Hashtable h = new Hashtable();
		h.put("uuid", uuid);
		String s = ""+b.handleCommand("connectionstatus", h);
		return s.equals("OK");
	}

	protected byte[] getKey(String uuid, boolean isread) throws Exception
	{
		File f2 = new File(getRootDir().getParentFile(), "peerbot");
		f2 = new File(f2, "peers");
		f2 = new File(getSubDir(f2, uuid, 2, 3), uuid);
		if (f2.exists())
		{
			Properties p = loadProperties(f2);
			String s = p.getProperty(isread ? "readkey" : "writekey");
			byte[] secret = s == null ? null : fromHexString(s);
			return secret;
		}
		
		return null;
	}
	
	public int readInt(InputStream is) throws Exception
	{
		byte[] ba = new byte[4];
		int i = 0;
		while (i<4)
		{
			ba[i] = (byte)(is.read() & 0xFF);
			if (ba[i] == -1)
			{
				if (i == 0) return -1;
				throw new Exception("Malformed stream");
			}
			i++;
		}
		return bytesToInt(ba, 0);
	}
	
	public int decrypt(String uuid, InputStream is, OutputStream os, Callback cb) throws Exception
	{
		// FIXME should use p.decrypt
		byte[] secret = getKey(uuid, true);
		// System.out.println("KEY: "+toHexString(secret));
		SuperSimpleCipher c = new SuperSimpleCipher(secret, false);
		
		int len = readInt(is);
		// System.out.println("Total length: "+len);
		
    	int numbytes = 0;
    	
    	JSONObject jo = null;
    	if (cb != null)
    	{
    		jo = new JSONObject();
    		jo.put("length", len);
    	}

    	while (len == -1 || numbytes < len)
    	{
    		int n = readInt(is);
    		// System.out.println("Num encrypted bytes: "+n);
    		if (n == -1) break;
    		
    		byte[] ba = new byte[n];
    		int i = 0;
    		while (i<n)
    		{
    			int j = is.read(ba, i, n-i);
    			if (j == -1) throw new Exception("Malformed stream");
    			i += j;
    		}
    		// System.out.println("GOT: "+new String(ba));
    		ba = c.decrypt(ba);
    		os.write(ba);
    		
    		// System.out.println("Num bytes read: "+ba.length);

    		numbytes += ba.length;
    		
            if (jo != null)
            {
            	jo.put("sent", numbytes);
            	cb.execute(jo);
            }
    	}
    	
    	return numbytes;
	}

	// FIXME should use p.encrypt
	public int encrypt(String uuid, InputStream is, OutputStream os, int len, int chunksize, Callback cb) throws Exception
	{
		byte[] secret = getKey(uuid, false);
		// System.out.println("KEY: "+toHexString(secret));
		SuperSimpleCipher c = new SuperSimpleCipher(secret, true);
		
		os.write(intToBytes(len));
		// System.out.println("Total length: "+len);
		
    	int numbytes = 0;
    	if (len != -1) chunksize = Math.min(len, chunksize);
    	
    	JSONObject jo = null;
    	if (cb != null)
    	{
    		jo = new JSONObject();
    		jo.put("length", len);
    	}
    	
    	int i;
		byte[] ba = new byte[chunksize];

		while (len == -1 || numbytes < len)
    	{
			i = len == -1 ? chunksize : Math.min(chunksize, len - numbytes);
			i = is.read(ba, 0, i);
			// System.out.println("Num bytes read: "+i);
			if (i == -1) break;
			
			if (i>0)
			{
				numbytes += i;
				byte[] ba2 = c.encrypt(ba, 0, i);
				os.write(intToBytes(ba2.length));
				// System.out.println("Num encrypted bytes: "+ba2.length);
				os.write(ba2);
				
                if (jo != null)
                {
                	jo.put("sent", numbytes);
                	cb.execute(jo);
                }
			}
			else try { Thread.sleep(100); } catch (Exception x) { x.printStackTrace(); }
    	}
		
		return numbytes;
	}
	
	public static Object sendCommand(String bot, String cmd, Hashtable params) throws Exception 
	{
		BotBase b = getBot(bot);
		return b.handleCommand(cmd, params);
	}

	public JSONObject sendCommand(String id, String bot, String cmd, Hashtable params) throws Exception
	{
		BotBase b = getBot("peerbot");
		return b.sendCommand(id, bot, cmd, params);
	}

	public JSONObject sendCommand(String id, String bot, String cmd, Hashtable params, long millis) throws Exception
	{
		BotBase b = getBot("peerbot");
		return b.sendCommand(id, bot, cmd, params, millis);
	}

	public void sendCommandAsync(String id, String bot, String cmd, Hashtable params, P2PCallback cb) throws Exception
	{
		PeerBot b = PeerBot.getPeerBot();
		b.sendCommandAsync(id, bot, cmd, params, cb);
	}
	
	public void start(Boolean b, File f) throws Exception 
	{
		ROOT = f;
		start(b);
	}

	public void start(Boolean b) throws Exception 
	{
		launchbrowser = b;
		start();
	}

	public void start() throws Exception  
	{
		File f = getRootDir();
		f.getParentFile().mkdirs();
		
		mMasterBot = this;
		init();

		OFF = false;
		RUNNING = true;

		String mid = getMachineID();
		System.out.println("Server "+getServiceName()+"("+mid+") starting up on port "+getPortNum());
		
		System.out.println("Server ready");
		
		SYS.RUNNING = true;
        addNumThreads(NUMHTTPTHREADS);

        HTTP = new HTTPService(this, getPortNum());

		if (!SYS.isHeadless() && launchbrowser) setTimeout(new Runnable() 
		{
			@Override
			public void run() 
			{
				launchBrowser();
			}
		}, "Launch Browser", 100);
		
		sessionChecker();        
	    
		mZeroConfServices.clear();
		SYS.RUNNING = false;
        removeNumThreads(5);
        
		while (!OFF) try {  Thread.currentThread().sleep(500); } catch (Exception x) { x.printStackTrace(); }
	}

	
	private void launchBrowser() 
	{
		try 
		{ 
			BotBase b = getBot("securitybot");

			String s = "";
			String sid = PROPERTIES.getProperty("defaultsession");
			if (sid != null) try
			{
				File f = new File(b.getRootDir(), "session.properties");
				Properties p = loadProperties(f);
				String user = p.getProperty(sid);
				f = new File(b.getRootDir(), "users");
				f = new File(f, user+".properties");
				if (f.exists())
				{
					p = loadProperties(f);
					String groups = ","+p.getProperty("groups")+",";
					if (groups.indexOf(",admin,") == -1) sid = null;
				}
				else sid = null;
			}
			catch (Exception x) 
			{
				x.printStackTrace();
				sid = null;
			}
			
			if (sid == null)
			{
				if (b != null)
				{
					File f = new File(b.getRootDir(), "users");
					File root = f;
					String[] list = root.list(new NoDotFilter());
					int i = list.length;
					while (i-->0) try
					{
						f = new File(root, list[i]);
						Properties p = loadProperties(f);
						String groups = ","+p.getProperty("groups")+",";
						if (groups.indexOf(",admin,") != -1)
						{
							String pass = p.getProperty("password");
							String user = list[i].substring(0, list[i].lastIndexOf('.'));
							Hashtable h = new Hashtable();
							h.put("user", user);
							h.put("pass", pass);
							JSONObject jo = b.handleLogin((String)h.get("user"), (String)h.get("pass"), (String)h.get("sessionid"));
//							s = s.substring(s.lastIndexOf('"')+1);
							s = jo.getString("sessionid");
							
							PROPERTIES.setProperty("defaultsession", s);
							saveSettings();
							
							h.put("sessionid", s);
							b.handleRememberSession("remembersession", h);
							
							s = "?sessionid="+s;
							break;
						}
					}
					catch (Exception x) { x.printStackTrace(); }
				}
			}
			else s = "?sessionid="+sid;
			
			String dbn = PROPERTIES.getProperty("defaultbot");
			if (dbn == null) dbn = getServiceName();
			b = getBot(dbn);
			if (b == null) b = this;
			SYS.browse(new URI("http://localhost:"+getPortNum()+"/"+dbn+"/"+b.getIndexFileName()+s)); 
//			Thread.sleep(1000);
//			SYS.browse(new URI("http://localhost:"+getPortNum()+"/"+dbn+"/"+b.getIndexFileName())); 
		}
		catch (Exception x) { x.printStackTrace(); } // IGNORE
	}
	public void validateRequest(BotBase bot, String cmd, Hashtable params) throws Exception  
	{
		String sid = (String)params.get("sessionid");
		if (sid == null) 
		{
			sid = uniqueSessionID();
			params.put("sessionid", sid);
		}
		
		Session s = getSession(sid, true);
		BotBase b = getBot("securitybot");
		if (b == null) 
		{
			if (s == null) 
			{
				if (sid != null)
				{
					String rem = PROPERTIES.getProperty(sid);
					if (rem != null && rem.equals(getAdminPassword()))
					{
						s = new Session();
						sessions.put(sid, s);
					}
					else throw new Exception("INVALID SESSION ID");
				}
				else throw new Exception("INVALID SESSION ID");
			}
		}
		else b.validateRequest(bot, cmd, params);

		if (s != null) updateSessionTimeout(s);
	}
	
	protected void updateSessionTimeout(Session s) 
	{
		s.expire = System.currentTimeMillis() + sessiontimeout;
	}
	
	public String getIndexFileName() 
	{
		return "index.html";
	}

	public URL extractURL(String cmd)
	{
		return getResource("html/"+getServiceName()+"/"+cmd);
	}
	
	public File extractFile(String cmd) {
		File f = findHTTPRoot();
		String s = hexDecode(cmd);
		int i = s.indexOf('?');
		if (i != -1) s = s.substring(0,i);
		
		while ((i = s.indexOf('/')) != -1)
		{
			f = new File(f, s.substring(0, i));
			s = s.substring(i+1);
		}
		f = new File(f, s);
//		try { System.out.println("HTTP: "+f.getCanonicalPath()); } catch (Exception x) { x.printStackTrace(); }

		return f;
	}

	public URL getResource(String name)
	{
//		if (!name.startsWith("/"))
//			name = "/"+name;
		return getClass().getClassLoader().getResource(name);
	}

	public Object loadClass(String classname) throws Exception
	{
		Class c = getClass().getClassLoader().loadClass(classname);
		return c.newInstance();
	}

	public File getRootDir() {
		if (ROOT == null)
		{
			File f = new File(System.getProperty("user.home"));
			f = new File(f, "Newbound");
			f = new File(f, "botd");
			f = new File(f, getServiceName());
			f.mkdirs();
			ROOT = f;
		}
		
		return ROOT;
	}

	protected File findHTTPRoot() {
		File f = getRootDir();
		f = new File(f, "html");
		f.mkdirs();
		
		return f;
	}

	@Deprecated
	protected JSONObject handleLogin(Hashtable params) throws Exception
	{
		throw new Exception("deprecated");
	}
	
	protected JSONObject handleLogin(String user, String pass, String sid) throws Exception
	{
		BotBase b = getBot("securitybot");
		if (b == null) 
		{
//			String user = (String)params.get("user");
//			String pass = (String)params.get("pass");
			if (user == null) throw new Exception("Username is required");
			if (pass == null) throw new Exception("Password is required");
			
			String password = getAdminPassword();
			
			if (user.equals("admin") && pass.equals(password))
			{
				if (sid == null) sid = uniqueSessionID();
				Session ses = new Session();
				sessions.put(sid, ses);

				JSONObject o = new JSONObject();
				o.put("status", "ok");
				o.put("msg", "You are now logged in\", \"sessionid\": \""+sid);
				o.put("sessionid", sid);
				
				return o;
			}
			throw new Exception("Invalid login attempt");
		}
		return b.handleLogin(user, pass, sid);
	}
	
	private String getAdminPassword() 
	{
		String password = PROPERTIES.getProperty("password");
		if (password == null) password = "admin";
		return password;
	}

	public Session getSessionByUsername(String username)
	{
		Enumeration<Hashtable> e = sessions.elements();
		while (e.hasMoreElements())
		{
			Session ses = (Session)e.nextElement();
			String un = (String)ses.get("username");
			if (un != null && un.equals(username)) return ses;
		}
		return null;
	}
	
	protected Session getSession(Hashtable params)
	{
		String sid = (String)params.get("sessionid");
		if (sid != null) return getSession(sid, true);
		return null;
	}

	public Session getSession(String sid)
	{
		return getSession(sid, false);
	}

	public Session getSession(String sid, boolean create) 
	{
		Session s = (Session)sessions.get(sid);
		if (s == null)
		{
			if (create)
			{
				s = new Session();
				sessions.put(sid, s);
			}
		}
		else s.expire = System.currentTimeMillis() + sessiontimeout;
			
		return s;
	}

	public boolean newDB(String db, JSONArray readers, JSONArray writers) throws Exception
	{
		if (mMasterBot == this) throw new Exception("Database not configured");
		else return mMasterBot.newDB(db, readers, writers);
	}
	
	public boolean setData(String db, String id, JSONObject data, JSONArray readers, JSONArray writers) throws Exception
	{
		if (mMasterBot == this) throw new Exception("Database not configured");
		else return mMasterBot.setData(db, id, data, readers, writers);
	}

	public boolean hasData(String db, String id) throws Exception
	{
		if (mMasterBot == this) throw new Exception("Database not configured");
		else return mMasterBot.hasData(db, id);
	}

	public JSONObject getData(String db, String id) throws Exception
	{
		if (mMasterBot == this) throw new Exception("Database not configured");
		else return mMasterBot.getData(db, id);
	}

	public JSONArray searchData(String db, JSONTransform t, JSONObject params, String sessionid) throws Exception
	{
		if (mMasterBot == this) throw new Exception("Database not configured");
		else return mMasterBot.searchData(db, t, params, sessionid);
	}
	
	public JSONObject deleteData(String db, String id) throws Exception
	{
		if (mMasterBot == this) throw new Exception("Database not configured");
		else return mMasterBot.deleteData(db, id);
	}
	
	protected void saveSettings() throws IOException 
	{
		FileWriter f = new FileWriter(new File(getRootDir(), "botd.properties"));
		PROPERTIES.store(f, "");
		f.close();
	}

	protected int getDefaultPortNum() 
	{
		return 5773;
	}

	protected int getPortNum() {
		String s = null;
		if (PROPERTIES != null) s = PROPERTIES.getProperty("portnum");
		if (s == null) 
			return getDefaultPortNum();
		
		return Integer.parseInt(s);
	}

	public boolean requirePassword()
	{
		BotBase b = getBot("securitybot");
		if (b == null) 
		{
			String requirepassword = PROPERTIES.getProperty("requirepassword");
			return (requirepassword != null && requirepassword.equals("true"));
		}
		return b.requirePassword();
	}

	public Object handleCommand(String method, String cmd, Hashtable headers, Hashtable params) throws Exception
	{
		  if (cmd.equals("login")) 
			  return handleLogin((String)params.get("user"), (String)params.get("pass"), (String)params.get("sessionid"));
		  else if (cmd.equals("remembersession")) 
			  return handleRememberSession(cmd, params);
		
		  while (cmd.endsWith("/")) cmd =  cmd.substring(0, cmd.length()-1);
		  
		  if (requirePassword()) validateRequest(this, cmd, params);
		  return handleCommand(cmd, params);
	}
	
	protected JSONObject handleRememberSession(String cmd, Hashtable params) throws Exception
	{
		BotBase b = getBot("securitybot");
		if (b == null) 
		{
			String sid = (String)params.get("sessionid");
			PROPERTIES.setProperty(sid, getAdminPassword());
			saveSettings();
		}
		else b.handleRememberSession(cmd, params);
		
		JSONObject o = new JSONObject();
		o.put("status", "ok");
		o.put("msg", "OK");
		
		return o;
	}

	public void websocketFail(WebSocket sock)
	{
		websocketClose(sock);
	}
	
	public void websocketClose(WebSocket sock)
	{
		String sc = socketChanel(sock);
		if (sc != null) closeChannel(sc);
		else try { sock.close(); } catch (Exception x) { x.printStackTrace(); }
		websockets.removeElement(sock);
	}
	
	// FIXME - make webSocketConnect synchronous and exception becomes unnecessary
	public void webSocketConnect(final WebSocket sock, final String cmd) throws Exception
	{
		websockets.addElement(sock);
		
		Runnable r = new Runnable()
		{
			public void run()
			{
				try
				{
//					System.out.println("Opening websocket connection");
					int pow7 = (int)Math.pow(2, 7);
					ByteArrayOutputStream baos = new ByteArrayOutputStream();
					int lastopcode = 0;
			
//					System.out.println("WEBSOCKET CONNECTED: "+sock.isConnected());
					InputStream is = sock.getInputStream();
					while (sock.isConnected()) 
					{
						int i = is.read();
						if (i != -1) 
						{
							boolean fin = (pow7 & i) != 0;
							boolean rsv1 = ((int)Math.pow(2, 6) & i) != 0;
							boolean rsv2 = ((int)Math.pow(2, 5) & i) != 0;
							boolean rsv3 = ((int)Math.pow(2, 4) & i) != 0;
							
							if (rsv1 || rsv2 || rsv3) websocketFail(sock);
							else
							{
								int opcode = (0xf & i);
								
								i = is.read();
								boolean mask = (pow7 & i) != 0;
								if (!mask) websocketFail(sock);
								else
								{
									long len = i - pow7;
									
									if (len == 126)
									{
										len = (is.read() & 0x000000FF) << 8;
										len += (is.read() & 0x000000FF);
									}
									else if (len == 127)
									{
										len = (is.read() & 0x0000007F) << 56;
										len += (is.read() & 0x000000FF) << 48;
										len += (is.read() & 0x000000FF) << 40;
										len += (is.read() & 0x000000FF) << 32;
										len += (is.read() & 0x000000FF) << 24;
										len += (is.read() & 0x000000FF) << 16;
										len += (is.read() & 0x000000FF) << 8;
										len += (is.read() & 0x000000FF);
									}
									
									int[] maskkey = new int[4];
									if (mask) {
										maskkey[0] = is.read();
										maskkey[1] = is.read();
										maskkey[2] = is.read();
										maskkey[3] = is.read();
									}

									int max = (int)Math.min(4096, len);
									byte[] buffer = new byte[max];
									long off = 0;
									while (off < len) 
									{	
										i = is.read(buffer, 0, (int)Math.min(4096, len-off));
										int n = i;
										if (mask) while (i-->0) buffer[i] = (byte)(buffer[i] ^ maskkey[((int)off+i) % 4]);
										baos.write(buffer, 0, n);
										off += n;
										/*
										System.out.println("-----------------------------------------------------------");
										System.out.println("OPCODE: "+opcode);
										System.out.println("LEN/OFF: "+len+"/"+off);
										System.out.println("FIN: "+fin);
										System.out.println("MASK: "+mask+" ["+maskkey[0]+", "+maskkey[1]+", "+maskkey[2]+", "+maskkey[3]+"]");
										System.out.println("-----------------------------------------------------------");
										String s = "";
										for (i=0; i<n; i++) s += (char)buffer[i];
										System.out.println(s);
										System.out.println("-----------------------------------------------------------");
										 */
									}

									if (opcode == 0)
									{
										// continuation frame
										System.out.println("continuation frame");
									}
									else if (opcode == 1 || opcode == 2) lastopcode = opcode;
									else if (opcode == 8)
									{
										// connection close
										System.out.println("connection close");
										websocketClose(sock);
									}
									else if (opcode == 9)
									{
										// ping
										System.out.println("ping");
									}
									else if (opcode == 10)
									{
										// pong
										System.out.println("pong");
									}
									else
										System.out.println("UNEXPECTED OPCODE: "+opcode);
			
									if (fin) try
									{
										baos.flush();
										baos.close();
										byte[] msg = baos.toByteArray();
										baos = new ByteArrayOutputStream();

										if (opcode == 0)
											opcode = lastopcode;

										if (opcode == 1)
										{
											// text frame
//											System.out.println("text frame");
											webSocketMessage(sock, new String(msg));
										}
										else if (opcode == 2)
										{
											// binary frame
//											System.out.println("binary frame");
											webSocketMessage(sock, msg);
										}
									}
									catch (Throwable t) { t.printStackTrace(); }
								}
							}
						}
						else Thread.sleep(500);
					}
				}
				catch (Throwable x) 
				{ 
					websockets.removeElement(sock);
					System.out.println("Removing websocket: "+x.getMessage());
				}
				finally
				{
					removeNumThreads(1);
				}
			}
		};
		addNumThreads(1);
		addJob(r, "WEBSOCKET");
	}
	
	Hashtable<String, Object[]> mSubscriptions = new Hashtable();
	
	public void webSocketMessage(final WebSocket sock, String msg) throws Exception
	{
//		System.out.println("TEXT MSG: "+msg);
		
		String sc = socketChanel(sock);
		if (msg.startsWith("cmd ")) try
		{
			JSONObject jo = new JSONObject(msg.substring(4));
			final String peer = jo.has("peer") ? jo.getString("peer") : null;
			final String bot = jo.getString("bot");
			final String cmd = jo.getString("cmd");
			final String pid = jo.getString("pid");
			
			final Hashtable params = new Hashtable();
			JSONObject jo2 = jo.getJSONObject("params");;
			Iterator<String> i = jo2.keys();
			while (i.hasNext())
			{
				String key = i.next();
				Object o = jo2.get(key);
				params.put(key, o);
			}
			params.put("sessionlocation", sock.getRemoteSocketAddress().toString());
			
			final P2PCallback cb = new P2PCallback() 
			{
				public P2PCommand execute(JSONObject jo2) 
				{
					try
					{
						jo2.put("pid", pid);
						sendWebsocketMessage(sock, jo2.toString());
					}
					catch (Exception x) { x.printStackTrace(); }
					
					return null;
				}
			};

			if (peer != null) sendCommandAsync(peer, bot, cmd, params, cb);
			else addJob(new Runnable() 
			{
				public void run() 
				{
					JSONObject jo2;
					try
					{
						validateRequest(getBot(bot), cmd, params);
						Object o = getBot(bot).handleCommand(cmd, params);
						if (o instanceof JSONObject) jo2 = (JSONObject)o;
						else
						{
							jo2 = newResponse();
							jo2.put("msg", o);
						}
					}
					catch (Exception x)
					{
						x.printStackTrace();
						jo2 = new JSONObject();
						try {
							jo2.put("status", "err");
							jo2.put("msg", x.getClass().getName()+": " + x.getMessage());
						}
						catch (Exception xx) { xx.printStackTrace(); }
					}
					
					cb.execute(jo2);
				}
			}, "WEBSOCKET cmd: "+peer+"/"+bot+"/"+cmd+"/"+params);
		}
		catch (Exception x)
		{
			x.printStackTrace();
		}
		else if (msg.startsWith("tempfile "))
		{
			try
			{
				JSONObject jo = new JSONObject(msg.substring(9));
				final String peer = jo.getString("peer");
				final String stream = jo.getString("stream");
				//final String pid = jo.getString("pid");
				String s = PeerBot.getPeerBot().getUploadedFile(peer, stream);
				byte[] ba = readFile(new File(s));
				String b64 = new String(Base64Coder.encodeBytes(ba));
				jo.put("data", b64);
				sendWebsocketMessage(sock, jo.toString());
			}
			catch (Exception x) { x.printStackTrace(); }
		}
		else if (sc != null) sendChannelMessage(sock, sc, msg);
		else if (msg.startsWith("subscribe "))
		{
			try
			{
//				synchronized(this)
				{
					msg = msg.substring(10);
					Object[] channel = mSubscriptions.get(msg);
					if (channel == null)
					{
						Vector<WebSocket> v2 = new Vector();
						Vector<Object[]> v3 = new Vector();
						channel = new Object[] { v2, v3 };
						mSubscriptions.put(msg,  channel);
					}
					
					Vector<WebSocket> v2 = (Vector<WebSocket>)channel[0];
					v2.add(sock);
					
					Hashtable params = new Hashtable();
					params.put("channel", msg);
					params.put("bot", getServiceName());
					
					JSONObject list = (JSONObject)sendCommand("peerbot", "connections", new Hashtable());
					list = list.getJSONObject("data");
					Iterator i = list.keys();
					while (i.hasNext())
					{
						String key = (String)i.next();
						JSONObject peer = list.getJSONObject(key);
						if (peer.getBoolean("connected"))
						{
							JSONObject jo = sendCommand(key, "peerbot", "subscribe", params);
							if (jo.getString("status").equals("ok"))
							{
								long stream = jo.getLong("stream");
								P2PConnection con = getStream(key, stream);
								addSubscriber(msg, peer, con);
							}
						}
					}
				}
			}
			catch (Exception x) { x.printStackTrace(); }
		}
	}
		
	private void sendChannelMessage(WebSocket sock, String sc, String msg) throws Exception
	{
//		synchronized(this)
		{
			Object[] channel = mSubscriptions.get(sc);
			if (channel != null)
			{
				byte[] ba = msg.getBytes();
				Vector<Object[]> v = (Vector<Object[]>)channel[1];
				int i = v.size();
				while (i-->0) try
				{
					Object[] oa = v.elementAt(i);
//					JSONObject peer = (JSONObject)oa[0];
					P2PConnection con = (P2PConnection)oa[1];
					OutputStream os = con.getOutputStream();
					os.write(0);
					os.write(longToBytes(ba.length));
					os.write(ba);
					os.flush();
				}
				catch (Exception x)
				{
					v.removeElementAt(i);
				}
				
				JSONObject jo = new JSONObject();
				jo.put("data", msg);
				jo.put("peer", getMachineID());
				msg = jo.toString();

				Vector<WebSocket> v2 = (Vector<WebSocket>)channel[0];
				i = v2.size();
				while (i-->0) try
				{
					WebSocket sock2 = v2.elementAt(i);
					if (sock2 != sock) sendWebsocketMessage(sock2, msg);
				}
				catch (Exception x)
				{
					v.removeElementAt(i);
				}
			}
		}
	}
	private String socketChanel(WebSocket sock) 
	{
//		synchronized(this)
		{
			Enumeration<String> e = mSubscriptions.keys();
			while (e.hasMoreElements())
			{
				String key = e.nextElement();
				Object[] oa = mSubscriptions.get(key);
				Vector<WebSocket> v = (Vector<WebSocket>)oa[0];
				int i = v.size();
				while (i-->0) if (v.elementAt(i) == sock) return key;
			}
		}
		return null;
	}
	
	public void addSubscriber(final String channel, final JSONObject peer, final P2PConnection con) throws Exception
	{
//		synchronized(this)
		{
			final Object[] oa = mSubscriptions.get(channel);
			if (oa == null) throw new Exception("No such channel");
			
			Object[] oa2 = { peer, con };
			Vector<Object[]> v2 = (Vector<Object[]>)oa[1];
			v2.addElement(oa2);
			
			final BotBase me = this; 
			
			Runnable r = new Runnable() 
			{
				public void run() 
				{
					InputStream is = con.getInputStream();
					while (SYS.RUNNING && mSubscriptions.get(channel) != null)
					{
						try
						{
							int type = is.read();
							if (type == -1) break;
							
							byte[] ba = new byte[8];
							for (int i=0; i<8; i++) ba[i] = (byte)is.read();
							long n = bytesToLong(ba, 0);
							ba = new byte[(int)n];
							for (int i=0; i<n; i++) ba[i] = (byte)is.read();

							JSONObject jo = new JSONObject();
							jo.put("data", new String(ba));
							jo.put("peer", peer.getString("name"));
							jo.put("uuid", peer.getString("id"));

//							synchronized(me)
							{
								Vector<WebSocket> v = (Vector<WebSocket>)oa[0];
								int i = v.size();
								while (i-->0)
								{
									WebSocket sock = v.elementAt(i);
									try { sendWebsocketMessage(sock, jo.toString().getBytes(), false); }
									catch (Exception x)
									{
										v.removeElementAt(i);
										if (v.size() == 0) closeChannel(channel);
									}
								}
							}
						}
						catch (Throwable x) 
						{
							try { con.close(); } catch (Exception xx) {}
							x.printStackTrace(); 
						}
					}
					removeNumThreads(1);
					System.out.println("Websocket thread end");
				}
			};
			addNumThreads(1);
			addJob(r, "SUBSCRIPTION: "+channel);
		}		
	}
	
	private void closeChannel(String channel)
	{
//		synchronized(this)
		{
			final Object[] oa = mSubscriptions.remove(channel);
			if (oa != null)
			{
				Vector<WebSocket> v = (Vector<WebSocket>)oa[0];
				while (v.size() > 0) 
				{
					WebSocket sock = v.remove(0);
					try { sock.close(); } catch (Exception x) {}
				}
				Vector<Object[]> v2 = (Vector<Object[]>)oa[1];
				while (v2.size() > 0) try
				{
					Object[] oa2 = v2.remove(0);
					((P2PConnection)oa2[1]).close();
				}
				catch (Exception x) { x.printStackTrace(); }
			}
		}
	}
	
	public void webSocketMessage(WebSocket sock, byte[] msg)
	{
		System.out.println("BINARY MSG: "+toHexString(msg));
	}
	
	public void sendWebsocketMessage(String msg) throws IOException
	{
		sendWebsocketMessage(msg.getBytes(), false);
	}
	
	public void sendWebsocketMessage(byte[] msg) throws IOException
	{
		sendWebsocketMessage(msg, true);
	}
	
	public void sendWebsocketMessage(byte[] msg, boolean bytes) throws IOException
	{
		Vector fails = new Vector();
		Enumeration<Socket> e = websockets.elements();
		while (e.hasMoreElements())
		{
			WebSocket sock = (WebSocket)e.nextElement();
			try { sendWebsocketMessage(sock, msg, bytes); }
			catch (Exception x)
			{
				System.out.println("Closing stale websocket: "+x.getMessage());
				fails.addElement(sock);
			}
		}
		
		e = fails.elements();
		while (e.hasMoreElements()) websocketFail((WebSocket)e.nextElement());
	}
	
	public void sendWebsocketMessage(WebSocket sock, String msg) throws IOException
	{
		sendWebsocketMessage(sock, msg.getBytes(), false);
	}
	
	public void sendWebsocketMessage(WebSocket sock, byte[] msg) throws IOException
	{
		sendWebsocketMessage(sock, msg, true);
	}
	
	public void sendWebsocketMessage(WebSocket sock, byte[] msg, boolean bytes) throws IOException
	{
		sock.sendWebsocketMessage(msg, 0, msg.length, bytes);
	}

	public String getMachineID() {
		if (mMasterBot == this) return PROPERTIES.getProperty("machineid");
		return mMasterBot.getMachineID();
	}
	
	public String getLocalID() 
	{
		BotBase bb = getBot("peerbot");
		return bb == null ? null : bb.getLocalID();
	}

	public void setMachineID(String name) {
		PROPERTIES.setProperty("machineid", name);
	}

	protected JSONObject newResponse()
	{
		try
		{
			JSONObject json = new JSONObject();
			json.put("status", "ok");
			json.put("msg", "OK");
			return json;
		}
		catch (Exception x) { x.printStackTrace(); }
		return null;
	}

	protected String handleShutdown(Hashtable params) throws Exception 
	{
		RUNNING = false;
		
		if (mMasterBot == this) try { HTTP.close(); } catch (Exception x) { x.printStackTrace(); } 
		try { mThreadHandler.shutdown(); } catch (Exception x) { x.printStackTrace(); } 
		while (websockets.size()>0)
			websockets.remove(0).close();

		OFF = true;

		return "The server has been shut down.";
	}
	
	protected String handleRestart(Hashtable params) throws Exception {
		new File(getRootDir(), "restart").createNewFile();
		handleShutdown(params);

		return "The server has restarted.";
	}

	@Deprecated
	protected String handleGetSettings(Hashtable params) throws Exception {
		throw new Exception("deprecated");
	}
	
	protected JSONObject handleGetSettings(String mid, String portnum, String requirepassword, String syncapps, String password) throws Exception {
//		String mid = (String)params.get("machineid");
//		String portnum = (String)params.get("portnum");
//		String requirepassword = (String)params.get("requirepassword");
//		String syncapps = (String)params.get("syncapps");
//		String password = (String)params.get("password");

		if (mid != null) PROPERTIES.setProperty("machineid", mid);
		if (portnum != null) PROPERTIES.setProperty("portnum", portnum);
		if (requirepassword != null) PROPERTIES.setProperty("requirepassword", ""+requirepassword);
		if (syncapps != null) PROPERTIES.setProperty("syncapps", ""+syncapps);
		if (password != null) PROPERTIES.setProperty("password", password);
		
		if (mid != null || portnum != null || requirepassword != null || password != null || syncapps != null)
		{
			saveSettings();
		}
		
		requirepassword = PROPERTIES.getProperty("requirepassword");
		if (requirepassword == null) requirepassword = "false";
		syncapps = PROPERTIES.getProperty("syncapps");
		if (syncapps == null) syncapps = "true";
		password = PROPERTIES.getProperty("password");
		if (password == null) password = "admin";
		
		JSONObject jo = newResponse();
		jo.put("machineid",  getMachineID());
		jo.put("portnum",  ""+getPortNum());
		jo.put("requirepassword",  requirepassword);
		jo.put("syncapps",  syncapps);
		jo.put("password",  password);
		
//		String s 
//			= "ok\", \"machineid\": \""
//			+ getMachineID()
//			+ "\", \"portnum\": \""
//			+ getPortNum()
//			+ "\", \"requirepassword\": \""
//			+ requirepassword
//			+ "\", \"syncapps\": \""
//			+ syncapps
//			+ "\", \"password\": \""
//			+ password;
		
//		return s;
		
		return jo;
	}

	public Properties getAppProperties() throws IOException
	{
		File f3 = new File(getRootDir(), "app.properties");
		return loadProperties(f3);
	}
	
	public void setAppProperties(Properties p) throws IOException
	{
		File f = new File(getRootDir(), "app.properties");
		storeProperties(p, f);
	}

	public static BotBase getBot(String bot)
	{
		if (mMasterBot.getServiceName().equals(bot)) return mMasterBot;
		return (BotBase)mBots.get(bot);
	}

	public SocketAddress getLocalSocketAddress() throws IOException
	{
		return HTTP.getLocalSocketAddress();
	}

	public InetSocketAddress getRemoteSocketAddress(Object socket) throws IOException
	{
        if (socket instanceof SocketChannel)
        	return (InetSocketAddress)((SocketChannel)socket).socket().getRemoteSocketAddress();

        return (InetSocketAddress)((Socket)socket).getRemoteSocketAddress();
	}

	public boolean isRunning()
	{
		return RUNNING;
	}

	public String[] getEventNames() 
	{ 
		String s = APPPROPERTIES.getProperty("events");
		if (s == null || s.length() == 0) return new String[0];
		
		return s.split(",");
	}
	
	protected Hashtable<String, Vector<Callback>> mEvents = new Hashtable();
	public void addEventListener(String event, Callback cb)
	{
		System.out.println("Adding event listener "+event);
		Vector<Callback> v = mEvents.get(event);
		if (v == null)
		{
			v = new Vector<Callback>();
			mEvents.put(event, v);
		}
		v.addElement(cb);
		
		System.out.println(getServiceName()+mEvents);
	}
	
	public void removeEventListener(String event, Callback cb)
	{
		System.out.println("Removing event listener "+event);
		Vector<Callback> v = mEvents.get(event);
		if (v != null)
		{
			v.remove(cb);
		}
	}
	
	public void fireEvent(String event, JSONObject data)
	{
//		if (false) 
		try
		{
			File f = new File(getRootDir(), "app.properties");
			Properties p = APPPROPERTIES; //loadProperties(f);
			String s = p.getProperty("events");
			if (s != null && s.startsWith("null,")) 
			{
				s = s.substring(5);
				p.setProperty("events", s);
				try { storeProperties(p, f); } catch (Exception x) { x.printStackTrace(); }
			}
			s = s == null || s.equals("") ? "" : ","+p.getProperty("events")+",";
			
			if (!s.contains(","+event+","))
			{
				s += event;
				while (s.startsWith(",")) s = s.substring(1);
				p.setProperty("events", s);
				try { storeProperties(p, f); } catch (Exception x) { x.printStackTrace(); }
			}
		}
		catch (Exception x) { x.printStackTrace(); }
		
//		System.out.println("Firing event listener "+event);
//		System.out.println(getServiceName()+mEvents);
/*
		Runnable r = new Runnable() 
		{
			@Override
			public void run() 
			{
*/
				Vector<Callback> v = mEvents.get(event);
				if (v != null)
				{
					Enumeration<Callback> e = v.elements();
					while (e.hasMoreElements())
					{
						System.out.println("EXECUTING CB");
						Callback cb = e.nextElement();
						try { cb.execute(data); } catch (Exception x) { x.printStackTrace(); }
					}
				}
//				else System.out.println("NO LISTENERS");
/*
			}
		};
		new Thread(r).start();
*/
	}
	public void init(File file) throws Exception 
	{
		ROOT = file;
		init();
	}

	public JSONObject sendEmail(String from, String to, String subject, String text) throws Exception
	{
        String htmlbody = "<html><head><title>"+subject+"</title></head><body><pre>"+text+"</pre></body></html>";
        return sendEmail(from, to, subject, text, htmlbody);
		
	}
	
	public JSONObject sendEmail(String from, String to, String subject, String text, String html) throws Exception
	{
		return sendEmail(from, to, subject, text, html, null); 
	}

	public JSONObject sendEmail(String from, String to, String subject, String text, String html, JSONArray attach) throws Exception
	{
		BotBase b = getBot("emailbot");
		return (JSONObject) b.sendEmail(from, to, subject, text, html, attach); 
	}

	public JSONArray checkPassword(String user, String pass) throws Exception
	{
		return getBot("securitybot").checkPassword(user, pass);
	}

	public P2PConnection newStream(String uuid) throws Exception
	{
		return getBot("peerbot").newStream(uuid);
	}
	
	public P2PConnection getStream(String uuid, long id) throws Exception
	{
		return getBot("peerbot").getStream(uuid, id);
	}

	public byte[] getPrivateKey()
	{
		return getBot("peerbot").getPrivateKey();
	}

	public byte[] getPublicKey()
	{
		return getBot("peerbot").getPublicKey();
	}

	public void addJob(Runnable o ) 
	{
		addJob(o, "");
	}

	public void addJob(Runnable o, String s) 
	{
		mThreadHandler.addJob(o, s);
	}
	
	public void addPeriodicTask(PeriodicTask pt)
	{
		mThreadHandler.addPeriodicTask(pt);
	}
	
	public void addPeriodicTask(final Runnable r, long millis, String name, final IsRunning ir)
	{
		mThreadHandler.addPeriodicTask(r, millis, name, ir);
	}
	
	public void addNumThreads(int numToAllocate)
	{
		//System.out.println("ADDING NUM THREADS "+numToAllocate);
		mThreadHandler.addNumThreads(numToAllocate);
	}

	public void setTimeout(final Runnable r, String name, long millis) 
	{
		PeriodicTask pt = new PeriodicTask(millis, false, name) { public void run() { r.run(); } };
		mThreadHandler.addPeriodicTask(pt);
	}
	
	public void removeNumThreads(int numToRemove)
	{
		mThreadHandler.removeNumThreads(numToRemove);
	}

	public String getID()
	{
		return getServiceName();
	}


	@Override
	public App find(String id) 
	{
		return getBot(id);
	}

	@Override
	public App getDefault() 
	{
//		String bot = ((BotManager)getBot("botmanager")).PROPERTIES.getProperty("defaultbot", "botmanager");
//		return mMasterBot;
		return this;
	}

	@Override
	public File extractLocalFile(String path) 
	{
		File htmlroot = new File(getRootDir().getParentFile().getParentFile(), "html");
		File f = new File(htmlroot, path);
		if (f.exists() && f.isDirectory()) f = new File(f, getIndexFileName());
		return f;
	}
	
	@Override
	public boolean running()
	{
		return RUNNING;
	}
	public Properties getUserProperties(String id, boolean b) throws IOException 
	{
		BotBase sb = getBot("securitybot");
		if (sb != null) return sb.getUserProperties(id, b);
		return null;
	}

	public String getProperty(String string) 
	{
		return PROPERTIES.getProperty(string);
	}

	// Originally from MetaBot
	public void compileAll() throws Exception
	{
		recompile();
	}

	private void recompile() throws Exception
	{
		File datadir = new File(getRootDir().getParentFile().getParentFile(), "data");

		String[] libs = libs().split(",");
		int i = libs.length;
		while (i-->0) try
		{
			String lib = libs[i];
			File libdir = new File(datadir, lib);
			new File(libdir, "version.txt").delete();
			rebuildLibrary(lib); } catch (Exception x) { x.printStackTrace();
		}
		File f = new File(getRootDir().getParentFile().getParentFile(), "generated");
		recompile(f, "");
	}

	private void recompile(File f, String pkg) throws ClassNotFoundException
	{
		if (f.isFile())
		{
			String name = f.getName();
			if (name.endsWith(".java")) try
			{
				name = name.substring(0, name.lastIndexOf('.'));
				Class.forName(pkg+"."+name);
			}
			catch (Exception x) { x.printStackTrace(); }
		}
		else if (f.isDirectory())
		{
			String[] list = f.list();
			int i = list.length;
			while (i-->0)
			{
				File f2 = new File(f, list[i]);
				if (f2.isDirectory())
				{
					String nupkg = pkg.equals("") ? "" : pkg+".";
					nupkg += list[i];
					recompile(f2, nupkg);
				}
				else recompile(f2, pkg);
			}
		}
	}

	protected void installUpdate(JSONObject libmeta, String lib, File tmp, String sessionid, Callback cb) throws Exception
	{
		if (cb != null)
		{
			JSONObject jo3 = new JSONObject();
			jo3.put("msg", "Verifying library "+lib+" contents");
			jo3.put("percent", 33);
			jo3.put("stage", 2);
			cb.execute(jo3);
		}

		String hash = getFileHash(tmp, cb);
		if (!hash.equals(libmeta.getString("hash")))
		{
			if (cb != null)
			{
				JSONObject jo3 = new JSONObject();
				jo3.put("msg", "Error: Hashes do not match");
				cb.execute(jo3);
			}
			throw new Exception("HASHES DO NOT MATCH");
		}

		String sig = libmeta.getString("signature");
		byte[] libkey = fromHexString(libmeta.getString("key"));

		P2PPeer p = PeerBot.getPeerBot().getPeer(libmeta.getString("author"));
		byte[] authkey = p.getPublicKey();
		if (authkey == null)
		{
			if (cb != null)
			{
				JSONObject jo3 = new JSONObject();
				jo3.put("msg", "Requesting public key for author: "+p.getName());
//				jo3.put("percent", 70);
				cb.execute(jo3);
			}

			Hashtable params = new Hashtable();
			params.put("uuid", p.getID());
			String s = (String)PeerBot.getPeerBot().handleCommand("pubkey", params);
			authkey = fromHexString(s);
			p.setPublicKey(authkey);
		}

		if (cb != null)
		{
			JSONObject jo3 = new JSONObject();
			jo3.put("msg", "Verifying library "+lib+" author");
//			jo3.put("percent", 75);
			cb.execute(jo3);
		}

		SuperSimpleCipher ssc = new SuperSimpleCipher(libkey, authkey, false);
		sig = toHexString(ssc.decrypt(fromHexString(sig)));

		if (!hash.equals(sig))
		{
			if (cb != null)
			{
				JSONObject jo3 = new JSONObject();
				jo3.put("msg", "Error: Signature does not match");
				cb.execute(jo3);
			}

			throw new Exception("SIGNATURE DOES NOT MATCH");
		}

		if (cb != null)
		{
			JSONObject jo3 = new JSONObject();
			jo3.put("msg", "Extracting from downloaded archive");
//			jo3.put("percent", 80);
			cb.execute(jo3);
		}

		BotManager bm = (BotManager)getBot("botmanager");
//		File datadir = new File(bm.getRootDir(), "data");
		File datadir = new File(bm.getRootDir().getParentFile().getParentFile(), "data");
		datadir = new File(datadir, lib);
		unZip(tmp, datadir);

		if (cb != null)
		{
			JSONObject jo3 = new JSONObject();
			jo3.put("msg", "Compiling library "+lib);
//			jo3.put("percent", 85);
			cb.execute(jo3);
		}

		File apps = new File(datadir, "_APPS");
		buildSource(lib, apps, getRootDir().getParentFile(), true, true);

		if (cb != null)
		{
			JSONObject jo3 = new JSONObject();
			jo3.put("msg", "Installing library "+lib);
			jo3.put("percent", 90);
			cb.execute(jo3);
		}

//		File metaapps = new File(getBot("metabot").getRootDir(), "apps");
		File metaapps = new File(newTempFile(), "apps");
//		deleteDir(metaapps);
		metaapps.mkdirs();
		buildSource(lib, getRootDir().getParentFile(), metaapps, true, false);
		deleteDir(apps);

		if (lib.equals("botmanager"))
		{
			File launcher = new File(getRootDir().getParentFile(), lib);
			launcher = new File(launcher, "src");
			launcher = new File(launcher, "com");
			launcher = new File(launcher, "newbound");
			File killme = new File(launcher, "robot");
			launcher = new File(launcher, "launcher");
			launcher = new File(launcher, "src.zip");

			File launchdest = getRootDir().getParentFile().getParentFile();
			unZip(launcher, launchdest);

			killme = new File(killme, "system");
			killme = new File(killme, "OperatingSystem.java");
			killme.delete();
		}

		if (cb != null)
		{
			JSONObject jo3 = new JSONObject();
			jo3.put("msg", "Verifying installation");
//			jo3.put("percent", 70);
			jo3.put("stage", 3);
			cb.execute(jo3);
		}

		try
		{
			String hash2 = getFileHash(metaapps, cb);
			File apphash = new File(datadir, "_APPS.hash");
			writeFile(apphash, hash2.getBytes());
		}
		catch (Exception x) { x.printStackTrace(); }

		File hashdir = new File(getBot("metabot").getRootDir(), "libraries");
		hashdir.mkdirs();
		File metafile = new File(hashdir, lib+".json");
		writeFile(metafile, libmeta.toString().getBytes());

		int version = libmeta.getInt("version");
		String name = lib+"_"+version+".zip";
		File libzip = new File(hashdir, name);
		copyFile(tmp, libzip);

		if (cb != null)
		{
			JSONObject jo3 = new JSONObject();
			jo3.put("msg", "Cleaning up...");
//			jo3.put("percent", 100);
			cb.execute(jo3);
		}

		deleteOldLibs(hashdir, lib, version);

		if (cb != null)
		{
			JSONObject jo3 = new JSONObject();
			jo3.put("msg", "Cleaning up...");
//			jo3.put("percent", 95);
			cb.execute(jo3);
		}

		deleteDir(metaapps);

		if (cb != null)
		{
			JSONObject jo3 = new JSONObject();
			jo3.put("msg", "");
			jo3.put("percent", 100);
			cb.execute(jo3);
		}

		JSONArray allapps = call("apps", new JSONObject()).getJSONObject("data").getJSONArray("list");
		JSONArray ja = libmeta.has("apps") ? libmeta.getJSONArray("apps") : new JSONArray();
		int i = ja.length();
		while (i-->0)
		{
			JSONObject rapp = ja.getJSONObject(i);
			String id = rapp.getString("id");
			int j = allapps.length();
			while (j-->0)
			{
				JSONObject lapp = allapps.getJSONObject(j);
				if (lapp.getString("id").equals(id))
				{
					int vr = rapp.getInt("version");
					int vl = lapp.getInt("version");
					if (vl<vr)
					{
						JSONObject params = new JSONObject();
						params.put("appinfo", rapp);
						params.put("sessionid", sessionid);
						call("installapp", params);
					}

					break;
				}
			}
		}
	}

	private void deleteOldLibs(File hashdir, String lib, int version)
	{
		int i = version;
		while (i-->0)
		{
			String n2 = lib+"_"+i+".zip";
			File f2 = new File(hashdir, n2);
			if (f2.exists()) f2.delete();
		}
	}

	public JSONObject sendLib(String lib, String peer) throws Exception
	{
		File hashdir = new File(getBot("metabot").getRootDir(), "libraries");
		File metafile = new File(hashdir, lib+".json");
		JSONObject libmeta = new JSONObject(new String(readFile(metafile)));

		int version = libmeta.getInt("version");
		String name = lib+"_"+version+".zip";
		final File libzip = new File(hashdir, name);

		final long len = libzip.length();

		P2PPeer p = PeerBot.getPeerBot().getPeer(peer);
		P2PConnection con = p.newStream();

		libmeta.put("stream", con.getID());
		libmeta.put("len",  len);

		final OutputStream os = con.getOutputStream();
		Runnable r = new Runnable()
		{
			public void run()
			{
				try
				{
					FileInputStream fis = new FileInputStream(libzip);
					sendData(fis, os, (int)len, 4096);
					os.flush();
					os.close();
					fis.close();
				}
				catch (Exception x) { x.printStackTrace(); }
			}
		};
		addJob(r);

		return libmeta;
	}

	protected File downloadUpdate(String lib, P2PPeer p, Callback cb) throws Exception
	{
		if (cb != null)
		{
			JSONObject jo = new JSONObject();
			jo.put("msg", "Downloading library "+lib+" from "+p.getName());
			jo.put("stage", 1);
			cb.execute(jo);
		}

		File tmp = newTempFile();
		Hashtable params = new Hashtable();
		params.put("lib", lib);
		params.put("peer", getLocalID());
		JSONObject jo = p.sendCommand("metabot", "sendlib", params).getJSONObject("data");

		int len = jo.getInt("len");
		String hash = jo.getString("hash");
		long stream = jo.getLong("stream");
		P2PConnection con = p.getStream(stream);
		if (con == null) throw new Exception("Unable to establish connection to "+p.getName());
		InputStream is = con.getInputStream();
		FileOutputStream fos = new FileOutputStream(tmp);
		sendData(is, fos, len, 4096, cb);
		fos.flush();
		fos.close();
		is.close();

		return tmp;
	}

	public JSONObject libStatus(String lib) throws Exception
	{
		JSONArray allapps = call("apps", new JSONObject()).getJSONObject("data").getJSONArray("list");

		JSONArray ja = new JSONArray();

		String[] sa = lib.split(",");
		int x = sa.length;
		while (x-->0)
		{
			lib = sa[x];

			File hashdir = new File(getBot("metabot").getRootDir(), "libraries");
			File f = new java.io.File(hashdir, lib+".json");

			JSONObject jo;
			if (!f.exists())
			{
				jo = new JSONObject();
				jo.put("dirty", true);
				jo.put("published", false);
			}
			else
			{
//			  File srcdir = new File(mMasterBot.getRootDir(), "data");
				File srcdir = new File(mMasterBot.getRootDir().getParentFile().getParentFile(), "data");
				srcdir = new File(srcdir, lib);

//			  File apps = new File(getBot("metabot").getRootDir(), "apps");
				File apps = new File(newTempFile(), "apps");
//			  deleteDir(apps);
				apps.mkdirs();
				buildSource(lib, getRootDir().getParentFile(), apps, true, false);

				String hash2 = getFileHash(apps);
				File apphash = new File(srcdir, "_APPS.hash");
				writeFile(apphash, hash2.getBytes());

				String newhash = getFileHash(srcdir);

				jo = new JSONObject(new String(readFile(f)));
				int version = jo.has("version") ? jo.getInt("version") : 0;
				String name = lib+"_"+version+".zip";
				File hashfile = new File(hashdir, lib+".hash");
				String oldhash = hashfile.exists() ? new String(readFile(hashfile)) : "";  //getFileHash(new File(hashdir, name)); //jo.has("hash") ? jo.getString("hash") : "";
				jo.put("dirty", !oldhash.equals(newhash));

				jo.put("published", true);
				deleteDir(apps);
			}

			jo.put("id", lib);

			JSONArray apps = new JSONArray();
			int i = allapps.length();
			while (i-->0)
			{
				JSONObject app = allapps.getJSONObject(i);
				JSONArray libs = app.getJSONArray("libraries");
				int j = libs.length();

				while (j-->0) if (libs.getString(j).equals(lib))
				{
					apps.put(app);
					break;
				}
			}
			jo.put("apps", apps);

			ja.put(jo);
		}

		JSONObject jo = new JSONObject();
		jo.put("libraries", ja);

//		System.out.println("SENDING LIBSTATUS: "+jo);

		return jo;
	}

	public void checkForUpdates(String libs, String sessionid)
	{
		if (libs == null) libs = libs();

		Iterator<P2PPeer> e = PeerBot.getPeerBot().getConnections();
		while (e.hasNext())
		{
			P2PPeer p = e.next();
			if (p.isConnected()) try
			{
				Hashtable h = new Hashtable();
				h.put("lib",  libs);
				JSONObject jo = p.sendCommand("metabot", "libraries", h);
				if (!jo.getString("status").equals("ok")) throw new Exception(jo.getString("msg"));
				jo = jo.getJSONObject("data").getJSONObject("data");
				JSONArray ja = jo.getJSONArray("list");
				int i = ja.length();
				while (i-->0)
				{
					jo = ja.getJSONObject(i);
					if (jo.has("version"))
					{
						int newv = jo.getInt("version");
						String lib = jo.getString("id");

						boolean b = false;

						File hashdir = new File(getBot("metabot").getRootDir(), "libraries");
						File f = new File(hashdir, lib+".json");
						if (!f.exists()) b = false;
						else
						{
							JSONObject jo2 = new JSONObject(new String(readFile(f)));
							if (!jo2.has("version")) b = true;
							else
							{
								int curv = jo2.getInt("version");
								b = curv < newv && jo2.getString("author").equals(jo.getString("author"));
							}
						}

						if (b)
						{
							updateLibrary(p, lib, jo, sessionid, null);
						}
					}
				}
			}
			catch (Exception x)
			{
				System.out.println("No updates from "+p.getName()+"/"+p.getID()+": "+x.getMessage());
			}
		}
	}

	public JSONObject apps() throws Exception
	{
		BotManager bm = (BotManager)mMasterBot;
		JSONObject apps = new JSONObject();

		File bpf = new File(bm.getRootDir(), "botd.properties");
		java.util.Properties bp = bm.loadProperties(bpf);
		JSONArray installed = new JSONArray(bp.getProperty("bots").split(","));
		installed.put("com.newbound.robot.BotManager");
		apps.put("installed", installed);

		JSONArray ja = new JSONArray();

		File root = bm.getRootDir().getParentFile();
		String[] sa = root.list();
		int i = sa.length;
		while (i-->0)
		{
			String id = sa[i];
			System.out.println(id);
			try
			{
				JSONObject jo = app(id);
				ja.put(jo);
			}
			catch (Exception x) { x.printStackTrace(); }
		}

		apps.put("list", ja);
		return apps;
	}

	private JSONObject app(String id) throws Exception
	{
		BotManager bm = (BotManager)mMasterBot;
		File root = bm.getRootDir().getParentFile();
		File bpf = new File(bm.getRootDir(), "botd.properties");
		java.util.Properties bp = bm.loadProperties(bpf);
		JSONObject identity = null;
		try { identity = bm.getData("runtime", "metaidentity").getJSONObject("data"); } catch (Exception x) {
			identity = new JSONObject();
			identity.put("displayname", "Sum Dev");
			identity.put("organization", "");
			identity.put("uuid", bm.getLocalID());
			try { bm.newDB("runtime", null, null); } catch (Exception xx) {}
			bm.setData("runtime", "metaidentity", identity, null, null);
		}

		java.io.File f = new java.io.File(root, id);
		if (f.isDirectory())
		{
			f = new java.io.File(f, "app.properties");
			if (f.exists())
			{
				java.util.Properties p = bm.loadProperties(f);
				JSONObject jo = new JSONObject();
				jo.put("id", id);
				jo.put("service", id);

				JSONArray libs;
				String s = p.getProperty("libraries");
				if (s != null) libs = new JSONArray(s.split(","));
				else libs = new JSONArray();
				jo.put("libraries", libs);

				s = p.getProperty("ctldb");
				if (s != null)
				{
					JSONObject ctl = new JSONObject();
					ctl.put("db", s);
					ctl.put("id", p.getProperty("ctlid"));
					jo.put("control", ctl);
				}

				String name = p.getProperty("name");
				if (name == null) name = id;
				jo.put("name", name);

				s = p.getProperty("desc");
				if (s == null) s = "The "+name+" application";
				jo.put("desc", s);

				s = p.getProperty("index");
				if (s == null) s = "index.html";
				jo.put("index", s);

				s = p.getProperty("price");
				if (s == null) s = "0";
				jo.put("price", Double.parseDouble(s));

				s = p.getProperty("forsale");
				if (s == null) s = "true";
				jo.put("forsale", Boolean.parseBoolean(s));

				s = p.getProperty("img");
				if (s == null) s = "/metabot/img/icon-square-app-builder.png";
				jo.put("img", s);

				s = p.getProperty("botclass");
				if (s == null) s = "com.newbound.robot.published."+bm.lettersAndNumbersOnly(name);
				jo.put("class", s);
				jo.put("active", id.equals("botmanager") || bp.getProperty("bots").indexOf(s) != -1);

				s = p.getProperty("version");
				if (s == null) s = "0";
				jo.put("version", s);

				s = p.getProperty("vendor");
				if (s == null) s = bm.getLocalID();
				jo.put("vendor", s);

				s = p.getProperty("vendorversion");
				if (s == null) s = "0";
				jo.put("vendorversion", s);

				s = p.getProperty("author");
				if (s == null)
				{
					s = bm.getLocalID();
					jo.put("authorname", identity.getString("displayname"));
					jo.put("authororg", identity.getString("organization"));
				}
				jo.put("author", s);

				s = p.getProperty("authorname");
				if (s != null) jo.put("authorname", s);

				s = p.getProperty("authororg");
				if (s != null) jo.put("authororg", s);

				s = p.getProperty("hash");
				if (s != null) jo.put("hash", s);

				s = p.getProperty("signature");
				if (s != null) jo.put("signature", s);

				s = p.getProperty("key");
				if (s != null) jo.put("key", s);

				JSONArray gen;
				s = p.getProperty("generate");
				if (s != null) gen = new JSONArray(s.split(","));
				else gen = new JSONArray();
				jo.put("generate", gen);

				jo.put("published", p.getProperty("key") != null);

				return jo;
			}
		}
		throw new Exception("No such app: "+id);
	}

	private String libs()
	{
		Vector<String> alllibs = new Vector();

//		File f = new File(mMasterBot.getRootDir(), "data");
		File f = new File(mMasterBot.getRootDir().getParentFile().getParentFile(), "data");
		String[] sa = f.list();
		int i;
		for (i=0;i<sa.length;i++)
		{
			String s = sa[i];
			if (f.isDirectory() && !s.startsWith(".")) try { if (getData(s, "tasklists") != null) alllibs.add(s); } catch (Exception x) {}
		}

		String libs = null;
		i = alllibs.size();
		while (i-->0) libs = (libs == null ? "" : libs+",")+alllibs.elementAt(i);

		return libs;
	}

	private void updateLibrary(P2PPeer p, String lib, JSONObject jo, String sid, Callback cb) throws Exception
	{
		File f = downloadUpdate(lib, p, cb);
		try { installUpdate(jo, lib, f, sid, cb); }
		finally { f.delete(); }

		rebuildLibrary(lib);
	}

	public JSONObject updateLibrary(String uuid, String lib, final String guid, String sessionid) throws Exception
	{
		P2PPeer p = PeerBot.getPeerBot().getPeer(uuid);

		Callback cb = guid == null ? null : new Callback()
		{
			long last = 0;

			long size = 0;
			long count = 0;

			int stage = 1;

			public void execute(JSONObject result)
			{
				try
				{
					result.put("guid", guid);
					long i = 0;

					if (result.has("stage")) stage = result.getInt("stage");
					long done = (stage-1)*size/3;

					if (result.has("sent") && result.has("length")) result.put("percent",  i = done + ((result.getLong("sent") * 100l) / (result.getLong("length")*3)));
					else if (result.has("percent")) i = done + (result.getLong("percent") / 3);
					else if (result.has("size")) { size = result.getLong("size"); count = 0; }
					else if (result.has("count"))
					{
						count += result.getLong("count");
						i = done*100/size + ((count * 100l) / (3*size));
						result.put("percent",  i);
					}
					else i = -1;

					if (result.has("msg") || i == -1 || i > last)
					{
						if (i != -1) last = i;
						sendWebsocketMessage(result.toString());
					}

				} catch (Exception x) { x.printStackTrace(); }
			}
		};

		JSONObject jo3 = new JSONObject();
		jo3.put("msg", "Requesting metadata for library "+lib+" from "+p.getName());
		jo3.put("percent", 0);
		cb.execute(jo3);

		Hashtable params = new Hashtable();
		params.put("lib",  lib);
		JSONObject jo = p.sendCommand("metabot", "libstatus", params).getJSONObject("data").getJSONArray("libraries").getJSONObject(0);

		updateLibrary(p, lib, jo, sessionid, cb);
		return newResponse();
	}

	private void extractLibrary(String lib, File tempdir)
	{
		try
		{
			System.out.println("METABOT extracting library "+lib);

//			File datadir = new File(mMasterBot.getRootDir(), "data");
			File datadir = new File(mMasterBot.getRootDir().getParentFile().getParentFile(), "data");

			if (!tempdir.exists())
			{
				InputStream is = getClass().getClassLoader().getResourceAsStream("data/"+getServiceName()+".zip");
				File temp = newTempFile();
				FileOutputStream fos = new FileOutputStream(temp);
				sendData(is, fos, -1, 4096);
				fos.flush();
				fos.close();
				is.close();

				unZip(temp, tempdir);
				temp.delete();
			}
			copyFolder(new File(tempdir, lib), new File(datadir, lib), true);
			rebuildLibrary(lib);
		}
		catch (Exception xx) { xx.printStackTrace(); }
	}
	/*
        private String buildpyapi(String db, String id, JSONObject jo) throws Exception
        {
            BotBase b = BotBase.getBot("botmanager");
            String py = "import sys\nimport json\nimport urllib.request\nfrom urllib.parse import urlencode, quote_plus\n\n";

            JSONArray cmds = jo.has("cmd") ? jo.getJSONArray("cmd") : null;
            int i,j;
            if (cmds != null) for (i=0;i<cmds.length();i++)
            {
                JSONObject cmd = cmds.getJSONObject(i);
                py += "def "+cmd.getString("name")+"(";

                String lang = cmd.has("lang") ? cmd.getString("lang") : "java";
                String cmdid = cmd.getString(lang);
                JSONObject data = b.getData(db, cmdid).getJSONObject("data");

                JSONArray params = data.has("params") ? data.getJSONArray("params") : new JSONArray();
                String args = "";
                for (j=0;j<params.length();j++)
                {
                    JSONObject p = params.getJSONObject(j);
                    if (j>0) py += ", ";
                    String name = p.getString("name");
                    py += name;
                    if (j>0) args += ",\n";
                    args += "    '"+name+"':"+name+"";
                }

                py += "):\n";
                py += "  args = {\n" +
                        args +
                        "\n  };\n" +
                        "  params = {\n" +
                        "    'db':'"+db+"',\n" +
                        "    'name':'"+jo.getString("name")+"',\n" +
                        "    'cmd':'"+cmd.getString("name")+"',\n" +
                        "    'args':args\n" +
                        "  }\n";
                py += "  querystring = urlencode(params, quote_via=quote_plus).replace('+', '%20')\n" +
                        "  contents = urllib.request.urlopen('http://localhost:5773/metabot/call?'+querystring)\n" +
                        "  s = contents.read().decode('utf-8') \n" +
                        "  val = json.loads(s)\n" +
                        "  return val\n\n";
            }

            return py;
        }
    */
	private String buildjsapi(String db, String id, JSONObject jo) throws Exception
	{
		//System.out.println("Building js api for "+db+":"+id);

		BotBase b = BotBase.getBot("botmanager");

		String newhtml = "";

//		System.out.println("**************************************************************************************************");
//		System.out.println(db+"/"+id);
//		System.out.println(jo);
//		System.out.println("**************************************************************************************************");
//		System.out.println("rebuilding "+db+"/"+id);

		JSONArray cmds = jo.has("cmd") ? jo.getJSONArray("cmd") : null;
		int i,j;
		if (cmds != null) for (i=0;i<cmds.length();i++) try
		{
			JSONObject cmd = cmds.getJSONObject(i);
			String x = cmd.getString("id");
			String y = cmd.getString("name");

			cmd = getData(db, x).getJSONObject("data");
			cmd.put("id", x); // FIXME - hack
			String lang = cmd.has("type") ? cmd.getString("type") : cmd.has("lang") ? cmd.getString("lang") : "java";
			String cmdid = cmd.getString(lang);
//		  System.out.println("lang: "+lang+" / src: "+cmdid+" / "+"cmd: "+cmd.getString("id"));
			JSONObject data = b.getData(db, cmdid).getJSONObject("data");
//		  System.out.println(data);
			JSONArray params = data.has("params") ? data.getJSONArray("params") : new JSONArray();

			if (!cmd.has("name")) {  // FIXME - hack
				cmd.put("name", y);
				//setData(db, x, readers, writers);
			}

			newhtml += "function send_"+cmd.getString("name")+"(";
			String args = "{";
			int n = 0;
			for (j=0;j<params.length();j++)
			{
				JSONObject p = params.getJSONObject(j);
				String type = p.getString("type");
				if (!type.equals("Bot") && !type.equals("Data"))
				{
					newhtml += p.getString("name");
					newhtml += ", ";
					if (n++>0) args += ", ";
					args += p.getString("name")+": "+p.getString("name");
				}
			}
			args += "}";


			newhtml += "xxxxxcb, xxxxxpeer){\n";
			newhtml += "  var args = " + args + ";\n";
			newhtml += "  var xxxprefix = xxxxxpeer ? '../peerbot/remote/'+xxxxxpeer+'/' : '../';\n";
			newhtml += "  args = encodeURIComponent(JSON.stringify(args));\n";
			newhtml += "  json(xxxprefix+'botmanager/execute', '"+"db="+java.net.URLEncoder.encode(db, "UTF-8")+"&id="+java.net.URLEncoder.encode(cmd.getString("id"), "UTF-8")+"&args='+args, function(result){\n    xxxxxcb(result);\n  });\n";
			newhtml += "}\n";
		}
		catch (Exception x) { x.printStackTrace(); }

		return newhtml;
	}

	public String buildJSAPI(String lib, String id) throws Exception
	{
		JSONObject ctl = getData(lib, id).getJSONObject("data");
		if (true) //(ctl.has("cmd"))
		{
			BotManager bm = (BotManager)getBot("botmanager");
			File f = new File(bm.getRootDir(), "html");
			f = new File(f, "generated");
			f = new File(f, "js");
			f = new File(f, lib);
			f.mkdirs();

			f = new File(f, id+".js");
			writeFile(f, buildjsapi(lib, id, ctl).getBytes());
/*
			f = new File(bm.getRootDir().getParentFile().getParentFile(), "python");
			deleteDir(new File(f, lib));
			f = new File(f, "newbound");
			f = new File(f, lib);
			f.mkdirs();

			if (!ctl.has("name"))
				ctl.put("name", id);

			String name = ctl.getString("name");
			f = new File(f, name+".py");
			String s = buildpyapi(lib, id, ctl);
//			s = s.replace('\r', '\n');
			writeFile(f, s.getBytes());
 */
		}

		return "OK";
	}

	public void rebuildLibrary(final String lib) throws Exception
	{
		System.out.println("METABOT evaluating library "+lib);

		final BotManager bm = (BotManager)getBot("botmanager");
		File libdir = new File(bm.getRootDir().getParentFile().getParentFile(), "data");
//		File libdir = new File(bm.getRootDir(), "data");
		libdir = new File(libdir, lib);
		String version = ""+libVersion(lib);
		File vfile = new File(libdir, "version.txt");
		if (vfile.exists()) try
		{
			System.out.println("Version file exists: "+vfile.getCanonicalPath());
			if (new String(readFile(vfile)).equals(version)) {
				System.out.println("Versions match: "+version);
				return;
			}
		}
		catch (Exception x) { x.printStackTrace(); }

		JSONArray controls = getData(lib, "controls").getJSONObject("data").getJSONArray("list");
		int j = controls.length();
		while (j-->0) try
		{
			JSONObject ctlptr = controls.getJSONObject(j);
			String id = ctlptr.getString("id");
			JSONObject ctl = getData(lib, id).getJSONObject("data");

			System.out.println("METABOT evaluating control "+(ctl.has("name") ? ctl.getString("name") : id));

			buildJSAPI(lib, id);

			if (ctl.has("cmd"))
			{
/*
				File f = new File(bm.getRootDir(), "html");
				f = new File(f, "generated");
				f = new File(f, "js");
				f = new File(f, lib);
				f.mkdirs();
				f = new File(f, id+".js");

				writeFile(f, buildjsapi(lib, id, ctl).getBytes());
*/
				final JSONArray cmds = ctl.getJSONArray("cmd");
				int k = cmds.length();
				while (k-->0)
				{
					JSONObject cmd = cmds.getJSONObject(k);
					cmd = getData(lib, cmd.getString("id")).getJSONObject("data");
					String[] langs = {"java", "python", "js"};
					int i = langs.length;
					while (i-->0) try
					{
						String lang = langs[i];

						if (cmd.has(lang)) {
							String codeid = cmd.getString(lang);
							JSONObject meta = getData(lib, codeid).getJSONObject("data");
							String code = meta.getString(lang);
							String groups = meta.has("groups") ? meta.getString("groups") : null;
							if (groups != null && !groups.startsWith("[")) {
								JSONArray ja = new JSONArray();
								ja.put(groups);
								groups = ja.toString();
							}
							String imports = meta.has("import") ? meta.getString("import") : null;
							String returntype = meta.has("returntype") ? meta.getString("returntype") : null;

							JSONArray params;
							if (meta.has("params")) params = meta.getJSONArray("params");
							else params = new JSONArray();

							bm.handleSaveCode(lang, lib, cmd.getString("id"), codeid, code, params.toString(), imports, returntype, groups, null, "");
						}
					}
					catch (Exception xx) { xx.printStackTrace(); }
				}
			}
/*
			if (true) //(ctl.has("cmd"))
			{
				File f = new File(mMasterBot.getRootDir(), "html");
				f = new File(f, "generated");
				f = new File(f, "js");
				f = new File(f, lib);
				f.mkdirs();
				f = new File(f, id+".js");

				writeFile(f, buildjsapi(lib, id, ctl).getBytes());
			}
*/
		}
		catch (Exception x) { x.printStackTrace(); }

		writeFile(vfile, version.getBytes());
	}

	private void startEvents(final String lib) throws Exception
	{
		System.out.println("METABOT starting events for library "+lib);
		JSONArray controls = getData(lib, "controls").getJSONObject("data").getJSONArray("list");
		int j = controls.length();
		while (j-->0)
		{
			JSONObject ctlptr = controls.getJSONObject(j);
			String id = ctlptr.getString("id");
			JSONObject ctl = getData(lib, id).getJSONObject("data");

			if (ctl.has("event"))
			{
				JSONArray events = ctl.getJSONArray("event");
				int k = events.length();
				while (k-->0) try
				{
					JSONObject t = events.getJSONObject(k);
					id = t.getString("id");

					t = getData(lib, id).getJSONObject("data");
					System.out.println("STARTING EVENT "+t);
					((BotManager)mMasterBot).handleEvent(id, "set", t.toString());
				}
				catch (Exception xx) { xx.printStackTrace(); }
			}
		}
	}

	private void startTimers(final String lib) throws Exception
	{
		System.out.println("METABOT starting timers for library "+lib);
		JSONArray controls = getData(lib, "controls").getJSONObject("data").getJSONArray("list");
		int j = controls.length();
		while (j-->0)
		{
			JSONObject ctlptr = controls.getJSONObject(j);
			String id = ctlptr.getString("id");
			JSONObject ctl = getData(lib, id).getJSONObject("data");

			if (ctl.has("timer"))
			{
				JSONArray timers = ctl.getJSONArray("timer");
				int k = timers.length();
				while (k-->0) try
				{
					JSONObject t = timers.getJSONObject(k);
					id = t.getString("id");

					t = getData(lib, id).getJSONObject("data");
					if (t.has("params"))
					{
						//					JSONObject p = t.getJSONObject("params");
						//					String s = p.toString();
						System.out.println("STARTING TIMER "+t);
						((BotManager)mMasterBot).handleTimer(id, "set", t.toString());
					}
					else System.out.println("NO PARAMS FOR TIMER "+t);
				}
				catch (Exception xx) { xx.printStackTrace(); }
			}
		}
	}

	private int libVersion(String lib) throws Exception
	{
		File hashdir = new File(new File(getRootDir().getParentFile(),"metabot"), "libraries");
		File f = new java.io.File(hashdir, lib+".json");
		if (!f.exists()) return 0;

		JSONObject jo = new JSONObject(new String(readFile(f)));
		int version = jo.has("version") ? jo.getInt("version") : 0;
		return version;
	}

	public JSONObject publishLibrary(String lib) throws Exception
	{
		BotManager bm = (BotManager)BotBase.getBot("botmanager");
		BotBase mb = BotBase.getBot("metabot");

//		File srcdir = new File(bm.getRootDir(), "data");
		File srcdir = new File(bm.getRootDir().getParentFile().getParentFile(), "data");
		srcdir = new File(srcdir, lib);

		File hashdir = new File(mb.getRootDir(), "libraries");
		hashdir.mkdirs();
		File metafile = new File(hashdir, lib+".json");
		JSONObject meta = metafile.exists() ? new JSONObject(new String(bm.readFile(metafile))) : new JSONObject();

		String myid = bm.getLocalID();
		int version = meta.has("version") ? meta.getInt("version") + 1 : 1;

		System.out.println("Publishing library "+lib+" v"+version);
		File srcmetafile = new File(srcdir, "meta.json");
		JSONObject srcmeta = new JSONObject(new String(readFile(srcmetafile)));
		srcmeta.put("version", version);
		File tmpdir = buildLibrary(lib, srcmeta);

		String name = lib+"_"+version+".zip";
		File f = new File(hashdir, name);
		FileOutputStream fos = new FileOutputStream(f);
		bm.zipDir(tmpdir, fos);
		fos.flush();
		fos.close();

		deleteDir(tmpdir);

		String hash = bm.getFileHash(f);
		String sig = hash;

		KeyPair kp = SuperSimpleCipher.generateKeyPair();
		byte[] prk = kp.getPrivate().getEncoded();
		byte[] pbk = kp.getPublic().getEncoded();
		byte[] myk = bm.getPrivateKey();

		SuperSimpleCipher ssc = new SuperSimpleCipher(myk, pbk, true);
		sig = bm.toHexString(ssc.encrypt(bm.fromHexString(sig)));

		meta.put("version", version);
		meta.put("key", bm.toHexString(prk));
		meta.put("author", myid);
		meta.put("signature", sig);
		meta.put("hash", hash);

		JSONObject identity = null;
		try { identity = bm.getData("runtime", "metaidentity").getJSONObject("data"); } catch (Exception x) {
			identity = new JSONObject();
			identity.put("displayname", "Sum Dev");
			identity.put("organization", "");
			identity.put("uuid", bm.getLocalID());
			try { bm.newDB("runtime", null, null); } catch (Exception xx) {}
			bm.setData("runtime", "metaidentity", identity, null, null);
		}
		meta.put("authorname", identity.getString("displayname"));
		meta.put("authororg", identity.getString("organization"));

		bm.writeFile(metafile, meta.toString().getBytes());
		bm.writeFile(srcmetafile, srcmeta.toString().getBytes());
		bm.writeFile(new File(hashdir, lib+".hash"), getFileHash(srcdir).getBytes());

		deleteOldLibs(hashdir, lib, version);
		return meta;
	}

	private File buildLibrary(String lib, JSONObject srcmeta) throws Exception
	{
		File tmpdir = newTempFile();
		tmpdir.mkdirs();

		publishData(lib, "tasklists", tmpdir);
		if (hasData(lib, "threejs_modellist")) publishData(lib, "threejs_modellist", tmpdir);
		JSONArray controls = publishData(lib, "controls", tmpdir).getJSONArray("list");

		int n = controls.length();
		for (int j=0;j<n;j++)
		{
			JSONObject ctlptr = controls.getJSONObject(j);
			String id = ctlptr.getString("id");
			publishControl(lib, id, tmpdir);
		}

//		File assets = new File(BotBase.getBot("botmanager").getRootDir(), "data");
		File assets = new File(BotBase.getBot("botmanager").getRootDir().getParentFile().getParentFile(), "data");
		assets = new File(assets, lib);
		assets = new File(assets, "_ASSETS");

		File assdest = new File(tmpdir, "_ASSETS");
		if (assets.exists())copyFolder(assets, assdest);
		else assdest.mkdirs();

		File apps = new File(tmpdir, "_APPS");
		apps.mkdirs();
		buildSource(lib, getRootDir().getParentFile(), apps, false, true);

		String hash = getFileHash(apps);
		File apphash = new File(tmpdir, "_APPS.hash");
		writeFile(apphash, hash.getBytes());

		File tmpmeta = new File(tmpdir, "meta.json");
		writeFile(tmpmeta, srcmeta.toString().getBytes());

		return tmpdir;
	}

	private Enumeration<String> buildSource(String lib, File source, File target, boolean overwrite, boolean copyprops) throws Exception
	{
		Vector<String> v = new Vector();
		String[] sa = source.list();
		int i = sa.length;
		while (i-->0)
		{
			File f = new File(source, sa[i]);
			f = new File(f, "app.properties");
			if (f.exists())
			{
				Properties p = loadProperties(f);
				String s = p.getProperty("libraries");
				if (s != null)
				{
					String[] libs = s.split(",");
					if (libs.length>0)
					{
						if (libs[0].equals(lib))
						{
							v.addElement(sa[i]);
							File dst = new File(target, sa[i]);
							if (overwrite || !dst.exists())
							{
								File src = new File(f.getParentFile(), "src");
								if (src.exists()) copyFolder(src, new File(dst, "src"));
								else new File(dst, "src").mkdirs();
								if (copyprops) copyFile(f, new File(dst, "app.properties"));
							}
						}
					}
				}
			}
		}

		return v.elements();
	}

	private void publishControl(String lib, String id, File tmpdir) throws Exception
	{
		JSONObject ctl = publishData(lib, id, tmpdir);

		if (ctl.has("data"))
		{
			JSONArray data = ctl.getJSONArray("data");
			int n = data.length();
			for (int k=0;k<n;k++)
			{
				JSONObject t = data.getJSONObject(k);
				String tid = t.getString("id");
				publishData(lib, tid, tmpdir);
			}
		}

		if (ctl.has("timer"))
		{
			JSONArray timer = ctl.getJSONArray("timer");
			int n = timer.length();
			for (int k=0;k<n;k++)
			{
				JSONObject t = timer.getJSONObject(k);
				String tid = t.getString("id");
				publishData(lib, tid, tmpdir);
			}
		}

		if (ctl.has("cmd"))
		{
			JSONArray cmds = ctl.getJSONArray("cmd");
			int n = cmds.length();
			for (int k=0;k<n;k++)
			{
				JSONObject cmd = cmds.getJSONObject(k);
				String cid = cmd.getString("id");

				try {
					cmd = getData(lib, cid).getJSONObject("data");
				}
				catch (Exception x) { x.printStackTrace(); }

				publishData(lib, cid, tmpdir);

				String lang = cmd.has("lang") ? cmd.getString("lang") : cmd.has("type") ? cmd.getString("type") : "java";
				String java = cmd.getString(lang);
				JSONObject meta = publishData(lib, java, tmpdir);
			}
		}
	}

	private JSONObject publishData(String lib, String id, File tmpdir) throws Exception
	{
		BotManager bm = (BotManager)BotBase.getBot("botmanager");
		JSONObject ctl = getData(lib, id).getJSONObject("data");
		SuperSimpleCipher[] keys = bm.getKeys(lib);
		boolean plaintext = keys.length == 0;

		File ctlfile = bm.getDataFile(lib, id, keys);
		String name = ctlfile.getName();

		File sub4 = ctlfile.getParentFile();
		File sub3 = sub4.getParentFile();
		File sub2 = sub3.getParentFile();
		File sub1 = sub2.getParentFile();
		File dest = new File(tmpdir, sub1.getName());
		dest = new File(dest, sub2.getName());
		dest = new File(dest, sub3.getName());
		dest = new File(dest, sub4.getName());
		dest.mkdirs();
		dest = new File(dest, name);

		copyFile(ctlfile, dest);

		if (plaintext && ctl.has("attachmentkeynames")) // FIXME - HACK
		{
			JSONArray ja = ctl.getJSONArray("attachmentkeynames");
			int i = ja.length();
			while (i-- > 0) {
				String key = ja.getString(i);
				File f1 = new File(ctlfile.getParentFile(), name + "." + key);
				File f2 = new File(dest.getParentFile(), name + "." + key);
				copyFile(f1, f2);
			}
		}

		return ctl;
	}

	public JSONObject publishApp(String appid) throws Exception
	{
		BotManager bm = (BotManager)mMasterBot;

		File hashdir = new File(bm.getBot("metabot").getRootDir(), "libraries");

		JSONArray list = call("metabot", "apps", new JSONObject()).getJSONObject("data").getJSONArray("list"); //apps.getJSONArray("list");
		int i = list.length();
		while (i-->0)
		{
			JSONObject app = list.getJSONObject(i);
			if (app.getString("id").equals(appid))
			{
				String service = app.getString("service");

				java.io.File build = bm.newTempFile(); // new java.io.File("/Users/mraiser/Desktop/BUILD"); //
				build.mkdirs();
				java.io.File src = new java.io.File(bm.getRootDir().getParentFile(), service);
				src = new java.io.File(src, "src");
				if (src.exists()) bm.copyFolder(src, build);

//	      java.io.File libsrc = new java.io.File(bm.getRootDir(), "data");
				java.io.File libsrc = new java.io.File(bm.getRootDir().getParentFile().getParentFile(), "data");
				java.io.File libtmp = bm.newTempFile();
				libtmp.mkdirs();

				JSONObject meta = new JSONObject();
				JSONArray libs = app.getJSONArray("libraries");
				int j = libs.length();
				while (j-->0)
				{
					String libname = libs.getString(j);

					int v = 0;
					File libmetaf = new File(hashdir, libname+".json");
					if (libmetaf.exists())
					{
						JSONObject libmeta = new JSONObject(new String(bm.readFile(libmetaf)));
						v = libmeta.getInt("version");
						String name = libname+"_"+v+".zip";
						File libzip = new File(hashdir, name);

						File libdir = new File(libtmp, libname);
						unZip(libzip, libdir);
					}
					meta.put(libname, v);
				}

				java.io.File libdest = new java.io.File(build, "data");
				libdest.mkdirs();
				java.io.FileOutputStream fos = new java.io.FileOutputStream(new java.io.File(libdest, service+".zip"));
				bm.zipDir(libtmp, fos);
				fos.flush();
				fos.close();
				bm.deleteDir(libtmp);
				bm.writeFile(new java.io.File(libdest, service+".json"), meta.toString().getBytes());

				java.io.File htmldir2 = new java.io.File(src, "html");
				htmldir2 = new java.io.File(htmldir2, service);
				htmldir2.mkdirs();

				java.io.File htmldir = new java.io.File(build, "html");
				htmldir = new java.io.File(htmldir, service);
				htmldir.mkdirs();

				File html = new File(htmldir, "index.html");
				if (!html.exists()) //(app.getJSONArray("generate").toString().indexOf("html") != -1)
				{
					String newhtml = "<html>\r  <head>\r    <meta charset=\"utf-8\">\r    <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\r    <meta name=\"description\" content=\"Rethink your internet. Newbound. http://newbound.io\">\r    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, minimum-scale=1.0\">\r	<title>"
							+ app.getString("name")
							+ "</title>\r\r    <link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css?family=Roboto:regular,bold,italic,thin,light,bolditalic,black,medium&amp;lang=en\">\r    <link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/icon?family=Material+Icons\">\r\r	<script src=\"../metabot/mdl/material.min.js\"></script>\r	<link rel=\"stylesheet\" href=\"../metabot/mdl/material.min.css\">\r	<link rel=\"stylesheet\" href=\"../metabot/mdl-selectfield-master/dist/mdl-selectfield.min.css\">\r	<script src=\"../metabot/mdl-selectfield-master/dist/mdl-selectfield.min.js\"></script>\r	<script src='../botmanager/jquerymobile/jquery-1.9.1.min.js'></script>\r	<script src='../botmanager/api.js'></script>\r	\r	<meta name='viewport' content='width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1'>\r  </head>\r  <body class='data-control' data-control='\r	{\r	  \"db\":\""
							+ app.getJSONObject("control").getString("db")
							+ "\",\r	  \"id\":\""
							+ app.getJSONObject("control").getString("id")
							+ "\"\r	}'>\r  </body>\r  <script>\r	$(document).ready(function( event, ui ) {\r	  activateControls(document);\r	});\r  </script>\r</html>";

					bm.writeFile(html, newhtml.getBytes());
					java.io.File html2 = new java.io.File(htmldir2, "index.html");
					bm.writeFile(html2, newhtml.getBytes());
				}

				File css = new File(htmldir, "index.css");
				if (!css.exists()) //(app.getJSONArray("generate").toString().indexOf("css") != -1)
				{
					String newcss = "";
					bm.writeFile(css, newcss.getBytes());
					java.io.File css2 = new java.io.File(htmldir2, "index.css");
					bm.writeFile(css2, newcss.getBytes());
				}

				File js = new File(htmldir, "index.js");
				if (!js.exists()) //(app.getJSONArray("generate").toString().indexOf("js") != -1)
				{
					String newjs = "";
					java.io.File js2 = new java.io.File(htmldir2, "index.js");
					bm.writeFile(js2, newjs.getBytes());
					bm.writeFile(js, newjs.getBytes());
				}

				String claz = app.getString("class");

				File javadir = getClassDir(build, claz);
				javadir.mkdirs();

				claz = claz.substring(app.getString("class").lastIndexOf(".")+1);

				File java = new File(javadir, claz+".java");
				if (!java.exists()) //(app.getJSONArray("generate").toString().indexOf("java") != -1)
				{
					String db = app.getJSONObject("control").getString("db");
					String id = lookupCtlID(db, app.getJSONObject("control").getString("id"));
					String newjava = "package com.newbound.robot.published;\r\rpublic class "
							+ claz
							+ " extends com.newbound.robot.BotBase \r{\r	public "
							+ claz
							+ "()\r	{\r		super();" +
							"\r";
/*
	        newjava += "		LIBRARIES = new String[]{ ";

	        j = libs.length();
	        while (j-->0)
	        {
	          newjava += "\""+libs.getString(j)+"\"";
	          if (j>0) newjava += ", ";
	        }

	        newjava += " };\r";
*/
					newjava += "	}\r	\r	public String DB() { return \"" + db + "\"; }\r	public String ID() { return \"" + id + "\"; }";

					newjava += "\r	\r	public String getServiceName() \r	{\r		return \""
							+ service
							+ "\";\r	}\r}\r";

					java.io.File jd2 = new java.io.File(src, "com");
					jd2 = new java.io.File(jd2, "newbound");
					jd2 = new java.io.File(jd2, "robot");
					jd2 = new java.io.File(jd2, "published");
					jd2.mkdirs();

					bm.writeFile(java, newjava.getBytes());
					bm.copyFile(java, new java.io.File(jd2, claz+".java"));
				}

				File codedest = new File(build, "code");
				codedest = new File(codedest, appid);
				codedest.mkdirs();
				File codetmp = newTempFile();
				FileOutputStream foss = new FileOutputStream(codetmp);
				zipDir(src, foss);
				foss.flush();
				foss.close();
				codetmp.renameTo(new File(codedest, "src.zip"));
				copyFile(new File(src.getParentFile(), "app.properties"), new File(codedest, "code.properties"));

//	      compileDirectory("", build, build);

				java.io.File jar = bm.newTempFile();
				fos = new java.io.FileOutputStream(jar);
				bm.zipDir(build, fos);
				fos.flush();
				fos.close();

				bm.deleteDir(build);

				int v = app.getInt("version")+1;
//	      java.io.File jardest = new java.io.File(bm.getRootDir(), "jars");
//	      jardest.mkdirs();
//	      jardest = new java.io.File(jardest, service+"_"+v+".jar");
//	      bm.copyFile(jar, jardest);
//	      jar.delete();

				java.io.File propfile = new java.io.File(bm.getRootDir().getParentFile(), service);
				propfile.mkdirs();
				propfile = new java.io.File(propfile, "app.properties");

				java.util.Properties p;
				if (propfile.exists()) p = bm.loadProperties(propfile);
				else
				{
					p = new java.util.Properties();
					p.setProperty("name", app.getString("name"));
					p.setProperty("id", app.getString("id"));
					p.setProperty("vendorversion", "1");
					p.setProperty("botclass", "com.newbound.robot.published."+app.getString("class"));
					p.setProperty("img", app.getString("img"));
					p.setProperty("price", ""+app.getDouble("price"));
					p.setProperty("forsale", ""+app.getBoolean("forsale"));
					p.setProperty("desc", app.getString("desc"));
					p.setProperty("index", "index.html");
					p.setProperty("vendor", bm.getLocalID());
				}

				String hash = bm.getFileHash(jar);
				p.setProperty("hash", hash);
				p.setProperty("version", ""+v);

				java.security.KeyPair kp = com.newbound.crypto.SuperSimpleCipher.generateKeyPair();
				byte[] prk = kp.getPrivate().getEncoded();
				byte[] pbk = kp.getPublic().getEncoded();
				byte[] myk = bm.getPrivateKey();

				com.newbound.crypto.SuperSimpleCipher ssc = new com.newbound.crypto.SuperSimpleCipher(myk, pbk, true);
				String sig = bm.toHexString(ssc.encrypt(bm.fromHexString(hash)));

				p.setProperty("key", bm.toHexString(prk));
				p.setProperty("signature", sig);

				JSONObject identity = null;
				try { identity = bm.getData("runtime", "metaidentity").getJSONObject("data"); } catch (Exception x) {
					identity = new JSONObject();
					identity.put("displayname", "Sum Dev");
					identity.put("organization", "");
					identity.put("uuid", bm.getLocalID());
					try { bm.newDB("runtime", null, null); } catch (Exception xx) {}
					bm.setData("runtime", "metaidentity", identity, null, null);
				}
				p.setProperty("author", bm.getLocalID());
				p.setProperty("authorname", identity.getString("displayname"));
				p.setProperty("authororg", identity.getString("organization"));

				bm.storeProperties(p, propfile);

//		        SYS.restart();

				publishToCloud(jar, service);
				jar.delete();

				app.put("version", v);
				app.put("hash", hash);

				if (!service.equals("botmanager"))
				{
					java.io.File bp = new java.io.File(bm.getRootDir(), "botd.properties");
					java.util.Properties prop = bm.loadProperties(bp);
					String bots = prop.getProperty("bots");
					if (bots.indexOf(app.getString("class")) == -1)
					{
						bots += ","+app.getString("class");
						prop.setProperty("bots", bots);
						bm.storeProperties(prop, bp);
					}
				}

				return app;
			}
		}

		throw new Exception("No such app");
	}

	private File getClassDir(File build, String claz)
	{
		int i;
		while ((i = claz.indexOf('.')) != -1)
		{
			String sub = claz.substring(0, i);
			claz = claz.substring(i+1);
			build = new File(build, sub);
		}

		return build;
	}

	private void publishToCloud(java.io.File jarfile, String name) throws Exception
	{
		PeerBot pb = PeerBot.getPeerBot();
		String hash = pb.getFileHash(jarfile);

		java.io.File f5 = new java.io.File(pb.getRootDir().getParentFile(), name);
		f5 = new java.io.File(f5, "app.properties");
		java.util.Properties p = pb.loadProperties(f5);
		String version = p.getProperty("version");
		String price = p.getProperty("price");
		String vendor = p.getProperty("vendor");
		String vendorversion = p.getProperty("vendorversion");

		p.setProperty("hash", hash);

		java.util.Hashtable h = new java.util.Hashtable();
		h.put("servicename", name);
		h.put("version", version);
		h.put("hash", hash);

		if (vendor == null)
		{
			vendor = pb.getLocalID();
			p.setProperty("vendor", vendor);
		}
		h.put("vendor", vendor);
		if (vendorversion == null)
		{
			vendorversion = "1";
			p.setProperty("vendorversion", vendorversion);
		}
		h.put("vendorversion", vendorversion);
		if (price == null)
		{
			price = "0.00";
			p.setProperty("price", price);
		}
		h.put("price", price);

		java.io.File f = new java.io.File(pb.getRootDir().getParentFile(), name);
		f = new java.io.File(f, "app.properties");
		pb.storeProperties(p, f);

//	    JSONObject o = pb.sendCommand("a51f6394-730b-4f64-83b0-96ad75f84537", "transaction", "publish", h);
//	    System.out.println("PUBLISHING TO CLOUD: "+o);
	}


	private void compileDirectory(String pkg, java.io.File root, java.io.File f)  throws Exception
	{
		System.out.println("COMPILING PACKAGE: "+pkg);

		String[] list = f.list();
		int i = list.length;
		while (i-->0)
		{
			java.io.File f2 = new java.io.File(f, list[i]);
			if (f2.isDirectory()) compileDirectory(pkg+list[i]+".", root, f2);
			else if (list[i].toLowerCase().endsWith(".java"))
			{
				String claz = list[i];
				claz = claz.substring(0, claz.lastIndexOf("."));
				claz = pkg + claz;

				System.out.println("COMPILING: "+claz);
				String out = SYS.compileClass(root, claz);
				if (!out.equals("")) throw new Exception(out);
			}
		}
	}
/*
	public String handleShutdown(Hashtable params) throws Exception {
		JSONObject jo = newResponse();
//		jo.put("a", handleCommand("shutdown", params));
		jo.put("b", super.handleShutdown(params));
		return jo.toString();
	}
*/
	public Object handleCommand(String cmd, Hashtable params) throws Exception
	{
		JSONObject args = new JSONObject(params);
		JSONObject jo = call(cmd, args);
		if (jo.has("data"))
		{
			Object o = jo.get("data");
			if (o instanceof File || o instanceof InputStream || o instanceof String) return o;
		}
		return jo;
	}

	public JSONObject call(String cmd, JSONObject params) throws Exception
	{
		return call(ID(), cmd, params);
	}

	public JSONObject call(String ctl, String cmd, JSONObject params) throws Exception
	{
		return call(DB(), ctl, cmd, params);
	}

	public JSONObject call(String db, String ctl, String cmd, JSONObject params) throws Exception
	{
		String id = lookupCmdID(db, ctl, cmd);
		if (id == null) throw new Exception404("UNKNOWN COMMAND: "+cmd);

		BotManager bm = (BotManager)mMasterBot;
		String sid = params.has("sessionid") ? params.getString("sessionid") : uniqueSessionID();
		bm.getSession(sid, true);

		JSONObject src = bm.handleRead(db, id, sid).getJSONObject("data");
		Code code = new Code(src, db);
		params.put("sessionid", sid);
		JSONObject jo = code.execute(params);
		return jo;
	}

	public JSONObject call(String peer, String db, String ctl, String cmd, JSONObject params) throws Exception
	{
		Hashtable args = new Hashtable();
		args.put("db", db);
		args.put("name", ctl);
		args.put("cmd", cmd);
		args.put("args", params);

		return sendCommand(peer, "metabot", "call", args);
	}

	public JSONObject call(String peer, String db, String ctl, String cmd, JSONObject params, long millis) throws Exception
	{
		Hashtable args = new Hashtable();
		args.put("db", db);
		args.put("name", ctl);
		args.put("cmd", cmd);
		args.put("args", params);

		return sendCommand(peer, "metabot", "call", args, millis);
	}

//	public String getIndexFileName()
//	{
//		return "index.html";
//	}

	public String lookupCtlID(String db, String name) throws Exception
	{
		JSONArray controls = getData(db, "controls").getJSONObject("data").getJSONArray("list");
		int j = controls.length();
		while (j-->0)
		{
			JSONObject ctlptr = controls.getJSONObject(j);
			if (ctlptr.getString("name").equals(name)) return ctlptr.getString("id");
			if (ctlptr.getString("id").equals(name)) return name;
		}

		return null;
	}

	public String lookupCmdID(String db, String ctl, String cmd) throws Exception
	{
		String ctl2 = lookupCtlID(db, ctl);
		if (ctl2 != null) ctl = ctl2;
		try
		{
			JSONObject DATA = getData(db, ctl).getJSONObject("data");
			JSONArray ja = DATA.getJSONArray("cmd");
			int i = ja.length();
			while (i-->0)
			{
				JSONObject jo = ja.getJSONObject(i);
				if (jo.getString("name").equals(cmd)) return jo.getString("id");
				if (jo.getString("id").equals(cmd)) return jo.getString("id");
			}
		}
		catch (Exception x) {}

		return null;
	}

	public JSONObject getCommands()
	{
		JSONObject commands = new JSONObject();
		JSONObject cmd;

		try
		{
			JSONObject DATA = getData(DB(), ID()).getJSONObject("data");
			JSONArray ja = DATA.has("cmd") ? DATA.getJSONArray("cmd") : new JSONArray();
			int i = ja.length();
			while (i-->0)
			{
				JSONObject jo = ja.getJSONObject(i);
				String lang = jo.has("lang") ? jo.getString("lang") : "java";
				JSONObject JAVA = getData(DB(), jo.getString(lang)).getJSONObject("data");

				cmd = new JSONObject();
				if (JAVA.has("groups")) cmd.put("groups", JAVA.getString("groups"));
				commands.put(jo.getString("name"), cmd);

				if (JAVA.has("desc"))
					cmd.put("desc", JAVA.getString("desc"));

				JSONArray params2 = new JSONArray();
				if (JAVA.has("params")) {
					JSONArray params1 = JAVA.getJSONArray("params");
					int n = params1.length();
					int j;
					for (j = 0; j < n; j++) params2.put(params1.getJSONObject(j).getString("name"));
				}
				cmd.put("parameters", params2);

			}
		}
		catch (Exception x) { x.printStackTrace(); }

		return commands;
	}

//	protected int getDefaultPortNum()
//	{
//		return 5773;
//	}

	public Object runtime(String name) { return RUNTIME.get(name); }
	public void runtime(String name, Object val) { RUNTIME.put(name, val); }

	public Object global(String name) { return Global.get(name); }
	public void global(String name, Object val) { Global.put(name, val); }

	public String getReturnType(String db, String ctl, String cmd) throws Exception
	{
		String id = lookupCmdID(db, ctl, cmd);
		if (id == null) throw new Exception404("UNKNOWN COMMAND: "+cmd);

		BotManager bm = (BotManager)mMasterBot;
		JSONObject src = bm.getData(db, id).getJSONObject("data");
		src = bm.getData(db, src.getString("cmd")).getJSONObject("data");
		String type = src.getString("returntype");
		return type;
	}

	public JSONArray getParams(String db, String ctl, String cmd) throws Exception
	{
		String id = lookupCmdID(db, ctl, cmd);
		if (id == null) throw new Exception404("UNKNOWN COMMAND: "+cmd);

		BotManager bm = (BotManager)mMasterBot;
		JSONObject src = bm.getData(db, id).getJSONObject("data");
		System.out.println(src);
		String cid = null;
		if (src.has("lang")) cid = src.getString(src.getString("lang"));
		else if (src.has("type")) cid = src.getString(src.getString("type"));
		else if (src.has("cmd")) cid = src.getString("cmd");
		else if (src.has("java")) cid = src.getString("java");
		src = bm.getData(db, cid).getJSONObject("data");
		return src.getJSONArray("params");
	}
}
