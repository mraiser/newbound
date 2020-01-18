package com.newbound.robot;

import java.io.ByteArrayInputStream;
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
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Properties;
import java.util.Vector;

import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.crypto.SuperSimpleCipher;
import com.newbound.net.service.App;
import com.newbound.net.service.Container;
import com.newbound.net.service.Socket;
import com.newbound.net.service.http.Exception404;
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
	
	public abstract Object handleCommand(String cmd, Hashtable params) throws Exception;
	public abstract JSONObject getCommands() throws Exception;
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
    	
        PROPERTIES = new Properties();

		try
		{
			File f = new File(getRootDir(), "botd.properties");
			if (f.exists()) 
			{
				FileInputStream fis = new FileInputStream(f);
				PROPERTIES.load(fis);
				fis.close();
			}
System.out.println("Loading Properties: "+f.getCanonicalPath());
			f = new File(getRootDir(), "app.properties");
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

	public void rebuildLibrary(String lib) throws Exception
	{
		BotBase bb = getBot("metabot");
		bb.rebuildLibrary(lib);
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
					System.out.println("Opening websocket connection");
					int pow7 = (int)Math.pow(2, 7);
					ByteArrayOutputStream baos = new ByteArrayOutputStream();
			
					System.out.println("WEBSOCKET CONNECTED: "+sock.isConnected());
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
										len = (is.read() & 0x000000FF) << 56;
										len += (is.read() & 0x000000FF) << 48;
										len += (is.read() & 0x000000FF) << 40;
										len += (is.read() & 0x000000FF) << 32;
										len += (is.read() & 0x000000FF) << 24;
										len += (is.read() & 0x000000FF) << 16;
										len += (is.read() & 0x000000FF) << 8;
										len += (is.read() & 0x000000FF);
									}
									
									int[] maskkey = new int[4];
									maskkey[0] = is.read();
									maskkey[1] = is.read();
									maskkey[2] = is.read();
									maskkey[3] = is.read();
			
									int max = (int)Math.min(4096, len);
									byte[] buffer = new byte[max];
									long off = 0;
									while (off < len) 
									{	
										i = is.read(buffer);
										off += i;
										int n = i;
										while (i-->0) buffer[i] = (byte)(buffer[i] ^ maskkey[i % 4]);
										baos.write(buffer, 0, n);
									}
									
									if (opcode == 0)
									{
										// continuation frame
										System.out.println("continuation frame");
									}
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
			
									if (fin) try
									{
										baos.flush();
										baos.close();
										byte[] msg = baos.toByteArray();
										baos = new ByteArrayOutputStream();
										
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
		System.out.println("TEXT MSG: "+msg);
		
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
							jo2.put("msg", "" + x.getMessage());
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
		String s = PROPERTIES.getProperty("events");
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
		System.out.println("ADDING NUM THREADS "+numToAllocate);
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
		
}
