package com.newbound.robot;

import java.io.*;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.SocketTimeoutException;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Properties;
import java.util.Vector;

import com.newbound.code.CodeEnv;
import com.newbound.code.LibFlow;
import com.newbound.p2p.P2PPeer;
import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.code.Code;
import com.newbound.crypto.SuperSimpleCipher;
import com.newbound.net.service.http.Exception404;
import com.newbound.thread.PeriodicTask;
import com.newbound.thread.Timer;
import com.newbound.util.NoDotFilter;

public class BotManager extends BotBase implements CodeEnv
{
	public String DB() { return "botmanager"; }
	public String ID() { return "rjvxkn1594bc321c2r2"; }

	private DiscoveryService DISCOVERY = null;
	private Hashtable<String, JSONObject> mEvents = new Hashtable();
	private Storage STORE = null;
//	protected ThreadHandler mThreadHandler = null;
	protected Timer mTimer = new Timer();
	protected String mSystemSessionID = null;

	public BotManager(File root)
	{
		this();
		ROOT = root;
	}

	public BotManager() 
	{
		super();
	}

	public void init() throws Exception
	{
		STORE = new Storage(getRootDir());

		super.init();

		String libflow = PROPERTIES.getProperty("libflow");
		if (libflow != null && libflow.equals("true"))
			LIBFLOW = true;
		Code.init(this);

		addNumThreads(100); // For timer task execution and general availability
/*
		File old = new File(getRootDir(), "data");
		if (old.exists())
		{
			File nu = new File(getRootDir().getParentFile().getParentFile(), "data");
			if (nu.exists())
			{
				File nunu = new File(nu.getParentFile(), "data_"+uniqueSessionID());
				nu.renameTo(nunu);
			}
			old.renameTo(nu);
			String[] sa = nu.list();
			int i = sa.length;
			while (i-->0)
			{
				File nunu = new File(nu, sa[i]);
				nunu = new File(nunu, "version.txt");
				nunu.delete();
			}
		}
*/		
		try
		{
			String discovery = PROPERTIES.getProperty("discovery");
			if (discovery == null || discovery.equals("true")) 
			{
				String mid = getMachineID();
				startDiscovery(mid, getPortNum());
			}
		}
		catch (Exception x)
		{
			x.printStackTrace();
		}

		try
		{
			File f = new File(getRootDir(), "timer");
			deleteDir(f);
			f.mkdirs();
		}
		catch (Exception x) { x.printStackTrace(); }
		
		String bots = PROPERTIES.getProperty("bots");
		if (bots == null) 
		{
			bots = SYS.defaultBots();
			PROPERTIES.setProperty("bots", bots);
			PROPERTIES.setProperty("defaultbot", SYS.defaultBot());
//			PROPERTIES.setProperty("defaultbot", "botmanager");
			saveSettings();
		}
//		if (bots.indexOf("FileBot") == -1) bots += ",com.newbound.robot.FileBot";
		
		if (bots != null && bots.trim().length() > 0)
		{
			File errorfile = new File(getRootDir(), "error.log");
			errorfile.delete();
			String botclass = null; 
			while (bots.length()>0)
			{
				int i = bots.indexOf(',');
				if (i==-1)
				{
					botclass = bots.trim();
					bots = "";
				}
				else
				{
					botclass = bots.substring(0,i).trim();
					bots = bots.substring(i+1).trim();
				}
				
				try
				{
//					BotBase b = (BotBase)loadClass(botclass);
					BotBase b = (BotBase)Class.forName(botclass).newInstance();
//					b.sessions = sessions;
					String sn = b.getServiceName();
					if (mBots.get(sn) != null) throw new Exception("Duplicate service name: "+sn);
					b.init(new File(getRootDir().getParentFile(), sn));
					b.setMachineID(getMachineID());
					mBots.put(sn, b);
					System.out.println("LOADED: "+sn);
					b.RUNNING = true;
				}
				catch (Exception x) 
				{ 
					x.printStackTrace(); 
					FileWriter fw = new FileWriter(errorfile, true);
					PrintWriter pw = new PrintWriter(fw);
					x.printStackTrace(pw);
					pw.flush();
					fw.flush();
					pw.close();
					fw.close();
				}
			}
		}

		rebuildLibrary("botmanager");
		rebuildLibrary("securitybot");

		try
		{
			Callback cb = new Callback() 
			{
				@Override
				public void execute(JSONObject task) 
				{
//					JSONObject result = task.getJSONObject("result");
//					String id = task.getString("id");
//					String cmd = task.getString("cmd");
//					String cmddb = task.getString("cmddb");
					
					fireEvent("timertask", task);
				}
			};

//			JSONObject jo = handleTimer(null, "list", null);
//			mTimer.init(jo.getJSONArray("list"), cb);
			mTimer.init(new JSONArray(), cb);
			mTimer.start();
		}
		catch (Exception x) { x.printStackTrace(); }
		
		try
		{
			String s = PROPERTIES.getProperty("pythonapp", "python3");
			Code.PYTHON = s;
		}
		catch (Exception x) { x.printStackTrace(); }

		RUNNING = true;
	}

	private void startDiscovery(String mid, int portNum) throws Exception 
	{
		if (DISCOVERY != null) try { stopDiscovery(); } catch (Exception x) { x.printStackTrace(); }
		
		DISCOVERY = new DiscoveryService(this);
		
		addPeriodicTask(new PeriodicTask(60000, true, "periodic discovery")
		{
			public void run() 
			{
				try { handleDiscover(); } catch (Exception x) { x.printStackTrace(); }
			}
		});
	}

	private void stopDiscovery() throws Exception
	{
		if (DISCOVERY != null)
		{
			DISCOVERY.close();
			DISCOVERY = null;
		}
	}

	@Override
	public Object handleCommand(String cmd, Hashtable params) throws Exception 
	{
		if (cmd.equals("getsettings")) return handleGetSettings(params, 1);
		if (cmd.equals("setdeviceinfo")) return handleSetDeviceInfo(params);
		if (cmd.equals("listbots")) return handleListBots(params);
		if (cmd.equals("restart")) return handleRestart(params);
		if (cmd.equals("startbot")) return handleStartBot(params);
		if (cmd.equals("asset") || cmd.startsWith("asset/")) {
			String db = (String)params.get("db");
			String name = (String)params.get("name");
			String FILEUPDLOAD = (String)params.get("FILEUPDLOAD");
			String delete = (String)params.get("delete");
			
			if (db == null){
			  cmd = cmd.substring(6);
			  int i = cmd.indexOf('/');
			  db = cmd.substring(0, i);
			  name = cmd.substring(i+1);
			}
			return handleAsset(db, name, FILEUPDLOAD, delete != null && delete.equals("true"));
		}
		if (cmd.equals("newdb") || cmd.startsWith("newdb/")) return handleNewdb((String)params.get("db"), (String)params.get("readers"), (String)params.get("writers"), (String)params.get("encryption"), (String)params.get("sessionid"));
		if (cmd.equals("convertdb") || cmd.startsWith("convertdb/")) return handleConvertdb((String)params.get("db"), (String)params.get("readers"), (String)params.get("writers"), (String)params.get("encryption"), (String)params.get("sessionid"));
		if (cmd.equals("write") || cmd.startsWith("write/")) return handleWrite((String)params.get("db"), (String)params.get("data"), (String)params.get("id"), (String)params.get("readers"), (String)params.get("writers"), (String)params.get("sessionid"), (String)params.get("sessionlocation"));
		if (cmd.equals("read") || cmd.startsWith("read/")) return handleRead((String)params.get("db"), (String)params.get("id"), (String)params.get("sessionid"));
		if (cmd.equals("delete") || cmd.startsWith("delete/")) return handleDelete((String)params.get("db"), (String)params.get("id"), (String)params.get("sessionid"));
		if (cmd.equals("jsearch") || cmd.startsWith("jsearch/")) return handleJSearch((String)params.get("db"), (String)params.get("id"), (String)params.get("java"), (String)params.get("imports"), (String)params.get("json"), (String)params.get("javascript"), (String)params.get("readers"), (String)params.get("writers"), (String)params.get("delete"), (String)params.get("sessionid"), (String)params.get("sessionlocation"));
		
		if (cmd.equals("execute") || cmd.startsWith("execute/")) 
		{
			JSONObject args = new JSONObject((String)params.get("args"));
			args.put("sessionlocation", (String)params.get("sessionlocation"));
			return handleExecute((String)params.get("db"), (String)params.get("id"), args, (String)params.get("sessionid"));
		}
		
		if (cmd.equals("savejava") || cmd.startsWith("savejava/")) return handleSaveJava((String)params.get("db"), (String)params.get("id"), (String)params.get("cmd"), (String)params.get("java"), (String)params.get("params"), (String)params.get("import"), (String)params.get("returntype"), (String)params.get("readers"), (String)params.get("writers"), (String)params.get("sessionid"));
		if (cmd.equals("savepython") || cmd.startsWith("savepython/")) return handleSavePython((String)params.get("db"), (String)params.get("id"), (String)params.get("cmd"), (String)params.get("python"), (String)params.get("params"), (String)params.get("import"), (String)params.get("returntype"), (String)params.get("readers"), (String)params.get("writers"), (String)params.get("sessionid"));
		if (cmd.equals("compile") || cmd.startsWith("compile/")) 
		{
			String db = (String)params.get("db");
			String id = (String)params.get("id");
			String cmd2 = (String)params.get("cmd");
			String java = (String)params.get("java");
			String python = (String)params.get("python");
			String js = (String)params.get("js");
			String flow = (String)params.get("flow");
			String rust = (String)params.get("rust");
			return handleCompile(db, id, cmd2, java, python, js, flow, rust, (String)params.get("params"), (String)params.get("import"), (String)params.get("returntype"), (String)params.get("readers"), (String)params.get("writers"), (String)params.get("sessionid"));
		}
		if (cmd.equals("timer") || cmd.startsWith("timer/")) return handleTimer((String)params.get("id"), (String)params.get("mode"), (String)params.get("params"));
		if (cmd.equals("event") || cmd.startsWith("event/")) return handleEvent((String)params.get("id"), (String)params.get("mode"), (String)params.get("params"));
		if (cmd.equals("events") || cmd.startsWith("events/")) return handleEvents((String)params.get("id"));
		if (cmd.equals("primitives") || cmd.startsWith("primitives/")) return handlePrimitives();
		if (cmd.equals("discover") || cmd.startsWith("discover/")) return handleDiscover();
		
		throw new Exception404("UNKNOWN COMMAND: "+cmd);
	}

	public JSONObject getCommands()
	{
		JSONObject commands = new JSONObject();
		JSONObject cmd;
		
		cmd = new JSONObject();
		cmd.put("desc", "All parameters are optional. Get or set basic system settings.");
		cmd.put("parameters", new JSONArray("[\"issetup\",\"defaultbot\",\"discovery\",\"machineid\",\"portnum\",\"requirepassword\",\"syncapps\",\"password\"]"));
		commands.put("getsettings", cmd);

		cmd = new JSONObject();
		cmd.put("desc", "Deprecated. Do not use.");
		commands.put("setdeviceinfo", cmd);

		cmd = new JSONObject();
		cmd.put("groups", "anonymous");
		cmd.put("desc", "List all currently running apps.");
		commands.put("listbots", cmd);

		cmd = new JSONObject();
		cmd.put("desc", "Restart the Newbound Network on this device.");
		commands.put("restart", cmd);

		cmd = new JSONObject();
		cmd.put("desc", "Deprecated. Do not use.");
		commands.put("startbot", cmd);
		
		cmd = new JSONObject();
		commands.put("newdb", cmd);
		cmd.put("desc", "Create a new library with the given name, encryption and permissions. If permissions are not specified, admin access will be required to access the library. Currently supported encryption types are AES and NONE.");
		cmd.put("parameters", new JSONArray("[\"db\",\"readers\",\"writers\",\"encryption\",\"sessionid\"]"));
		cmd.put("groups", "admin");

		cmd = new JSONObject();
		commands.put("convertdb", cmd);
		cmd.put("desc", "Convert the permissions and on-disk encryption for this library. Currently supported encryption types are AES and NONE.");
		cmd.put("parameters", new JSONArray("[\"db\",\"readers\",\"writers\",\"encryption\",\"sessionid\"]"));
		cmd.put("groups", "admin");

		cmd = new JSONObject();
		commands.put("write", cmd);
		cmd.put("desc", "Write the data to the given library with the given permissions. If no record ID is provided, a unique one will be assigned and returned. The user who writes the record has default read access. If permissions are not specified, admin access will be required to access this record otherwise.");
		cmd.put("parameters", new JSONArray("[\"db\",\"data\",\"id\",\"readers\",\"writers\",\"sessionid\",\"sessionlocation\"]"));
		cmd.put("groups", "anonymous");
		
		cmd = new JSONObject();
		commands.put("read", cmd);
		cmd.put("desc", "Read the given record from the given library.");
		cmd.put("parameters", new JSONArray("[\"db\",\"id\",\"sessionid\"]"));
		cmd.put("groups", "anonymous");

		cmd = new JSONObject();
		commands.put("delete", cmd);
		cmd.put("desc", "Delete the given record from the given library.");
		cmd.put("parameters", new JSONArray("[\"db\",\"id\",\"sessionid\"]"));
		cmd.put("groups", "anonymous");

		cmd = new JSONObject();
		commands.put("jsearch", cmd);
		cmd.put("desc", "Search the given library with the given saved search ID. If the java parameter is specified, it will replace the saved search algorithm with the given code.");
		cmd.put("parameters", new JSONArray("[\"db\",\"id\",\"java\",\"imports\",\"json\",\"javascript\",\"readers\",\"writers\",\"delete\",\"sessionid\",\"sessionlocation\"]"));
		cmd.put("groups", "anonymous");

		cmd = new JSONObject();
		commands.put("execute", cmd);
		cmd.put("desc", "Execute the given command.");
		cmd.put("parameters", new JSONArray("[\"db\",\"id\",\"args\",\"sessionid\"]"));
		cmd.put("groups", "anonymous");

		cmd = new JSONObject();
		commands.put("savejava", cmd);
		cmd.put("desc", "Save the given command.");
		cmd.put("parameters", new JSONArray("[\"db\",\"id\",\"cmd\",\"java\",\"python\",\"js\",\"params\",\"import\",\"returntype\",\"readers\",\"writers\",\"sessionid\"]"));

		cmd = new JSONObject();
		commands.put("savepython", cmd);
		cmd.put("desc", "Save the given command.");
		cmd.put("parameters", new JSONArray("[\"db\",\"id\",\"cmd\",\"java\",\"python\",\"js\",\"params\",\"import\",\"returntype\",\"readers\",\"writers\",\"sessionid\"]"));

		cmd = new JSONObject();
		commands.put("compile", cmd);
		cmd.put("desc", "Compile the given command.");
		cmd.put("parameters", new JSONArray("[\"db\",\"id\",\"cmd\",\"java\",\"python\",\"js\",\"params\",\"import\",\"returntype\",\"readers\",\"writers\",\"sessionid\"]"));

		cmd = new JSONObject();
		commands.put("timer", cmd);
		cmd.put("desc", "Administer timer rules. Supported modes are 'get', 'set' and 'kill'.");
		cmd.put("parameters", new JSONArray("[\"id\",\"mode\",\"params\"]"));

		cmd = new JSONObject();
		commands.put("event", cmd);
		cmd.put("desc", "Administer event rules. Supported modes are 'get', 'set' and 'kill'.");
		cmd.put("parameters", new JSONArray("[\"id\",\"mode\",\"params\"]"));

		cmd = new JSONObject();
		commands.put("events", cmd);
		cmd.put("desc", "List the events that a given app generates.");
		cmd.put("parameters", new JSONArray("[\"id\"]"));

		cmd = new JSONObject();
		commands.put("primitives", cmd);
		cmd.put("desc", "List the primitive functions installed on this device.");
		cmd.put("parameters", new JSONArray());
		cmd.put("groups", "anonymous");

		cmd = new JSONObject();
		commands.put("asset", cmd);
		cmd.put("desc", "Return the given asset from the given library <br><b>Usage:</b> http://localhost:5773/botmanager/asset/LIBNAME/ASSETNAME.ext");
		cmd.put("parameters", new JSONArray());
		cmd.put("groups", "anonymous");

		cmd = new JSONObject();
		commands.put("discover", cmd);
		cmd.put("desc", "Return the list of peers available on the local network.");
		cmd.put("parameters", new JSONArray());

		return commands;
	}
	
	protected String handleRestart(final Hashtable params) throws Exception {
		addJob(new Runnable() 
		{
			@Override
			public void run() 
			{
				try
				{
					new File(getRootDir(), "restart").createNewFile();
					handleShutdown(params);
				}
				catch (Exception x) { x.printStackTrace(); }
			}
		});
		
		return "The server is restarting.";
	}

	protected Vector getBotList()
	{
		String s = PROPERTIES.getProperty("bots");
		Vector v = new Vector();
		int i;
		while ((i = s.indexOf(',')) != -1)
		{
			v.addElement(s.substring(0,i).trim());
			s = s.substring(i+1).trim();
		}
		v.addElement(s);
		
		return v;
	}
	
	protected void setBotList(Vector v) throws Exception
	{
		String s = "";
		Enumeration e = v.elements();
		while (e.hasMoreElements()) 
		{
			 s += e.nextElement();
			 if (e.hasMoreElements()) s += ",";
		}
		PROPERTIES.setProperty("bots", s);
		saveSettings();
	}
	
	private String handleStartBot(Hashtable params) throws Exception
	{
		String botclass = (String)params.get("botclass");
		String autostart = (String)params.get("autostart");
		
		if (!botclass.equals(getClass().getCanonicalName()))
		{
			BotBase b = (BotBase)loadClass(botclass);
	//		BotBase b = (BotBase)Class.forName(botclass).newInstance();
	//		b.sessions = sessions;
			String sn = b.getServiceName();
	
			
			if (autostart != null && autostart.equals("true"))
			{
				Vector bots = getBotList();
				if (bots.indexOf(botclass) == -1) 
				{
					bots.addElement(botclass);
					setBotList(bots);
				}
			}
	
			BotBase b2 = (BotBase)mBots.get(sn);
			if (b2 != null) 
			{
				try
				{
//					b2.OFF = true;
					b2.handleShutdown(params);
	//				BotLauncher.reload(params);
				}
				catch (Exception x) { x.printStackTrace(); }
			}
	
			b.init();
			mBots.put(sn, b);
			System.out.println("LOADED: "+sn);
		}
		
		return "OK";
	}

	private JSONObject handleListBots(Hashtable params) throws Exception 
	{
		String includeself = (String)params.get("includeself");
		
//		String s = "OK\", \"data\": [ ";
		JSONObject o = newResponse();
		JSONArray ja = new JSONArray();
		Hashtable h = (Hashtable)mBots.clone();
		if (includeself != null && includeself.equals("true")) h.put(getServiceName(), this);

		Enumeration e = h.elements();
		while (e.hasMoreElements())
		{
			BotBase b = (BotBase)e.nextElement();
			Properties p = b.getAppProperties();
			
			String botname = b.getServiceName();
			String botclass = b.getClass().getCanonicalName();
			String index = b.getIndexFileName();
			
			JSONObject jo = new JSONObject();
			jo.put("botname", botname);
			jo.put("botclass", botclass);
			jo.put("index", index);
			
			try 
			{
				long l = 0; //b.checkRegistration(false);
				boolean registered = l == 0;
				jo.put("registered", registered);
				if (!registered)
				{
					long day = 1000l*60l*60l*24l;
					jo.put("expires", l/day);
				}
			}
			catch (Exception x) { x.printStackTrace(); }
			
//			s += "{ \"botname\": \""+botname+"\", \"botclass\": \""+botclass+"\", \"index\": \""+index+"\"";
			Enumeration<Object> e2 = p.keys();
			while (e2.hasMoreElements()) 
			{
				String key = (String)e2.nextElement();
//				s += ", \""+key+"\": \""+p.getProperty(key)+"\"";
				jo.put(key, p.getProperty(key));
			}
//			s += " }";
			ja.put(jo);
//			if (e.hasMoreElements()) s += ", ";
		}
//		s += " ], \"xxx\": \"x";
		
		ja = sort(ja, "name");
		o.put("data", ja);
		return o;
	}

	protected JSONObject handleGetSettings(Hashtable params, int y) throws Exception 
	{
		boolean b = false;

		String issetup = (String)params.get("issetup");
		if (issetup != null)
		{
			PROPERTIES.setProperty("issetup", issetup);
			b = true;
		}
		
		String defaultbot = (String)params.get("defaultbot");
		if (defaultbot != null)
		{
			PROPERTIES.setProperty("defaultbot", defaultbot);
			b = true;
		}
		
		String discovery = (String)params.get("discovery");
		if (discovery != null)
		{
			PROPERTIES.setProperty("discovery", discovery);
			b = true;

			try
			{
				if (discovery.equals("true")) 
				{
					String mid = getMachineID();
					startDiscovery(mid, getPortNum());
				}
				else stopDiscovery();
			}
			catch (Exception x) { x.printStackTrace(); }
		}
		else 
		{
			discovery = PROPERTIES.getProperty("discovery");
			if (discovery == null) discovery = "true";
		}
		
		if (b) saveSettings();

		String su = System.getProperty("user.name");
		
//		String s = super.handleGetSettings(params)
//			+ "\", \"discovery\": \""
//			+ discovery
//			+ "\", \"sysuser\": \""
//			+ su
//			+ "\", \"defaultbot\": \""
//			+ PROPERTIES.getProperty("defaultbot");
		
//		return s;
		
		JSONObject jo = super.handleGetSettings((String)params.get("machineid"), (String)params.get("portnum"), (String)params.get("requirepassword"), (String)params.get("syncapps"), (String)params.get("password"));
		jo.put("discovery", discovery);
		jo.put("sysuser", su);
		jo.put("defaultbot", PROPERTIES.getProperty("defaultbot"));
		jo.put("sys", SYS.osType());
		jo.put("os", System.getProperty("os.name"));
		
		return jo;
	}
	
	// FIXME THIS NEEDS TO NOT BE HERE -->SYS
	protected String handleSetDeviceInfo(final Hashtable params) throws Exception 
	{
		PeriodicTask r = new PeriodicTask(5000, false, "restart")
		{
		  public void run()
		  {
			  try
			  {
				String mid = (String)params.get("machineid");
				String host = (String)params.get("hostname");
				String apid = (String)params.get("apid");
				String appass = (String)params.get("appass");
				String wifiid = (String)params.get("wifiid");
				String wifipass = (String)params.get("wifipass");
				String root = (String)params.get("root");
				String userx = (String)params.get("username");
				String passx = (String)params.get("password");
				String sid = (String)params.get("sessionid");
				String restart = (String)params.get("restart");
				
				if (mid != null)
				{
					PROPERTIES.setProperty("machineid", mid);
					saveSettings();
				}
				
				if (host != null) writeFile(new File("/etc/hostname"), host.getBytes());
				if (apid != null) 
				{
					if (appass == null) throw new Exception("Access point mode password is required");
					writeFile(new File("/etc/hostapd/hostapd.conf"), ("interface=wlan0\nssid="+apid+"\ncountry_code=US\nhw_mode=g\nchannel=6\nmacaddr_acl=0\nauth_algs=1\nignore_broadcast_ssid=0\nwpa=2\nwpa_passphrase="+appass+"\nwpa_key_mgmt=WPA-PSK\nwpa_pairwise=CCMP\nwpa_group_rekey=86400\nieee80211n=1\nwme_enabled=1\n").getBytes());
				}
				if (root != null)
				{
					Process p = Runtime.getRuntime().exec(new String[] { "chpasswd" });
					PrintWriter writer = new PrintWriter(p.getOutputStream());
					writer.println("root:"+root);
					writer.close();
				}
				if (userx != null)
				{
					if (passx == null) throw new Exception("User password is required");
					Session s = getSession(params);
				    String currentuser = (String)s.get("username");
				    Properties user = (Properties)s.get("user");
				    if (!userx.equals(currentuser))
				    {
				    	Hashtable h = new Hashtable();
				    	h.put("username", userx);
				    	h.put("password", passx);
				    	h.put("groups", "admin");
				    	h.put("sessionid", sid);
				    	BotBase b = getBot("securitybot");
				    	b.handleCommand("newuser", h);
				    	
				    	h = new Hashtable();
				    	h.put("user", userx);
				    	h.put("pass", passx);
				    	h.put("sessionid", sid);
				    	b.handleLogin(userx, passx, sid);
				    	
				    	h = new Hashtable();
				    	h.put("username", currentuser);
				    	h.put("sessionid", sid);
				    	b.handleCommand("deleteuser", h);
				    }
				    else if (!passx.equals(user.getProperty("password")))
					{
				    	Hashtable h = new Hashtable();
				    	h.put("username", userx);
				    	h.put("displayname", userx);
				    	h.put("password", passx);
				    	h.put("groups", "admin");
				    	h.put("sessionid", sid);
				    	BotBase b = getBot("securitybot");
				    	b.handleCommand("updateuser", h);
					}
				    
				    String uuid = getLocalID();
				    
			    	Hashtable h = new Hashtable();
			    	h.put("username", userx);
			    	h.put("userid", userx);
			    	h.put("password", passx);
			    	h.put("email", userx+"@"+uuid+".nn");
			    	h.put("type", "0");
			    	h.put("server", "localhost");
			    	h.put("port", "9999");
			    	h.put("status", "New account");
			    	h.put("sessionid", sid);
			    	BotBase b = getBot("emailbot");
			    	b.handleCommand("addaccount", h);
				}
				
				if (wifiid != null)
				{
					if (wifipass == null) throw new Exception("Password to join Wi-Fi is required");
		
					java.io.FileWriter fw = new java.io.FileWriter("/etc/wpa_supplicant/wpa_supplicant.conf");
					fw.write("network={\n    ssid=\"");
					fw.write(wifiid);
					fw.write("\"\n    psk=\"");
					fw.write(wifipass);
					fw.write("\"\n}\n");
					fw.flush();
					fw.close();
		
					File f = new File(getRootDir().getParentFile(), "newboundpowerstrip");
					f = new File(f, "curmode.txt");
					fw = new FileWriter(f);
					fw.write("SWITCHING\r\n");
					fw.flush();
					fw.close();
		
					systemCall("service hostapd stop");
					systemCall("service isc-dhcp-server stop");
					systemCall("update-rc.d hostapd disable");
					systemCall("update-rc.d isc-dhcp-server disable");
					writeFile(new File("/etc/network/interfaces"), ("auto lo\n\niface lo inet loopback\niface eth0 inet dhcp\n\nallow-hotplug wlan0\niface wlan0 inet manual\nwpa-roam /etc/wpa_supplicant/wpa_supplicant.conf\niface default inet dhcp").getBytes());
					systemCall("service wpa_supplicant start");
				}
				
				if (restart != null && restart.equals("true")) systemCall("reboot");
			  }
			  catch (Exception x) { x.printStackTrace(); }
		  }
		};
		addPeriodicTask(r);

	    return "OK";
	}
	

	public String handleShutdown(Hashtable params) throws Exception 
	{
		String s = "";
		try { super.handleShutdown(params); } catch (Exception x) { x.printStackTrace(); s = x.getMessage(); } 
		
		RUNNING = false;
		mTimer.stop();
		
		Enumeration e = mBots.elements();
		while (e.hasMoreElements()) try
		{
			BotBase b = (BotBase)e.nextElement();
			b.handleShutdown(params);
		}
		catch (Exception x) { x.printStackTrace(); }
		
		mBots.clear();
		
		stopDiscovery();
		
		return s;
	}

	public String getServiceName() 
	{
		return "botmanager";
	}

	public static void main(String[] args) 
	{
		try 
		{
			new BotManager().start();
		} 
		catch (Exception x) 
		{
			x.printStackTrace();
		}
	}

	public BotBase resolveBot(String cmd)
	{
		return (BotBase)mBots.get(cmd);
	}

	public String getIndexFileName() 
	{
//		if (PROPERTIES.getProperty("issetup") == null) 
//			return "setup.html";
		return "index.html";
	}

	public Object handleAsset(String db, String name, String FILEUPDLOAD, boolean delete) throws Exception
	{
//		File f = new File(getRootDir(), "data");
		File f = new File(getRootDir().getParentFile().getParentFile(), "data");
		f = new File(f, db);
		f = new File(f, "_ASSETS");
		f = new File(f, name);
		
		if (delete)
		{
			f.delete();
			return "OK";
		}
		else if (FILEUPDLOAD != null) // FIXME - check security
		{
			if (f.exists()) throw new Exception("There is already an asset with that name in this libraray, (probably from a different control).");
			
			File f2 = new File(FILEUPDLOAD);
			if (f2.exists())
			{
				f.getParentFile().mkdirs();
				copyFile(f2, f);
				return "OK";
			}
		}
		else if (f.exists()) return f;
		
		throw new Exception("No such asset: "+db+"/"+name);
	}

	// FIXME - does not handle plaintext to encrypted attachments
	public Object handleConvertdb(String db, String readers, String writers, String encryption, String sessionid) throws Exception
	{
		File f = getDB(db);
		if (!f.exists()) throw new Exception("No such database: "+db);
		
		Session ses = getSession(sessionid);
		String username = (String)ses.get("username");
		
		File mf = new File(f, "meta.json");
		JSONObject meta = mf.exists() ? new JSONObject(new String(readFile(mf))) : new JSONObject();
		meta.put("id", db);
		meta.put("username", username);
		if (readers != null) meta.put("readers", new JSONArray(readers));
		if (writers != null) meta.put("writers", new JSONArray(writers));
		
		if (encryption == null)
		{
			writeFile(mf, meta.toString().getBytes());
			return "OK";
		}
		
		byte[] writekey = null;
		
		if (encryption == null || encryption.equals("AES"))
		{
			writekey = SuperSimpleCipher.getSeed(SuperSimpleCipher.KEYSIZE);
			String crypt = toHexString(writekey);
			meta.put("crypt", crypt);
		}
		else meta.remove("crypt");
		
		SuperSimpleCipher[] ssca;
		
		if (writekey == null) ssca = new SuperSimpleCipher[0];
		else
		{
			SuperSimpleCipher sscw = new SuperSimpleCipher(writekey, true);
			SuperSimpleCipher sscr = new SuperSimpleCipher(writekey, false);
			ssca = new SuperSimpleCipher[2];
			ssca[0] = sscr;
			ssca[1] = sscw;
		}
		
		File f2 = getTempFile(uniqueSessionID());
		f2.mkdirs();
		writeFile(new File (f2, "meta.json"), meta.toString().getBytes());
		
		File f3 = new File(f, _a);
		if (f3.exists()) copyFolder(f3, new File(f2, _a));
		
		convertdb(f, f2, getKeys(db), ssca);
		
		File f4 = new File(f.getParentFile().getParentFile(), "converted");
		f4.mkdirs();
		f4 = new File(f4, f2.getName());
		f.renameTo(f4);
		f2.renameTo(f);
		
		STORE.KEYS.put(db, ssca);
		
		return "Old version moved to: "+f4.getCanonicalPath();
	}
	
	String _a = "_ASSETS";
	String _h = "_APPS.hash";

	private void convertdb(File f, File dest, SuperSimpleCipher[] keys1, SuperSimpleCipher[] keys2) throws Exception 
	{
		String[] sa = f.list(new NoDotFilter());
		int i = sa.length;
		while (i-->0)
		{
			String s = sa[i];
			if (!s.equals(_a) && !s.equals(_h) && !s.equals("meta.json") && !s.equals("version.txt"))
			{
				File f3 = new File(f, s);
				if (f3.isDirectory()) convertdb(f3, dest, keys1, keys2);
				else convertfile(f3, dest, keys1, keys2);
			}
		}
	}

	private void convertfile(File f3, File dest, SuperSimpleCipher[] keys1, SuperSimpleCipher[] keys2) throws Exception
	{
		String idx = f3.getName();
		String name = keys1.length == 0 ? idx : new String(keys1[0].decrypt(fromHexString(idx)));
		name = keys2.length == 0 ? name : toHexString(keys2[1].encrypt(name.getBytes()));
		
		File f4 = getSubDir(dest, name, 4, 4);
		f4.mkdirs();
		f4 = new File(f4, name);
		
		byte[] ba = readFile(f3);
		
		ba = keys1.length == 0 ? ba : keys1[0].decrypt(ba);
		
		writeFile(f4, keys2.length == 0 ? ba : keys2[1].encrypt(ba));
	}

	public Object handleNewdb(String db, String readers, String writers, String encryption, String sessionid) throws Exception
	{
		Session s = getSession(sessionid);
		String username = (String)s.get("username");
		
		File f = getDB(db);
		if (f.exists()) throw new Exception("That database already exists");
		
		f.mkdirs();
		JSONObject meta = new JSONObject();
		meta.put("id", db);
		meta.put("username", username);
		if (readers != null) meta.put("readers", new JSONArray(readers));
		if (writers != null) meta.put("writers", new JSONArray(writers));
		
		byte[] writekey = null;
		
		if (encryption == null || encryption.equals("AES"))
		{
			writekey = SuperSimpleCipher.getSeed(SuperSimpleCipher.KEYSIZE);
			String crypt = toHexString(writekey);
			meta.put("crypt", crypt);
		}
		
		f = new File (f, "meta.json");
		writeFile(f, meta.toString().getBytes());
		
		SuperSimpleCipher[] ssca;
		
		if (writekey == null) ssca = new SuperSimpleCipher[0];
		else
		{
			SuperSimpleCipher sscw = new SuperSimpleCipher(writekey, true);
			SuperSimpleCipher sscr = new SuperSimpleCipher(writekey, false);
			ssca = new SuperSimpleCipher[2];
			ssca[0] = sscr;
			ssca[1] = sscw;
		}
		
		STORE.KEYS.put(db, ssca);
		
		fireEvent("newdb", meta);
		
		return "OK";
	}

	public JSONObject handleWrite(String db, String data, String id, String readers, String writers, String sessionid, String sessionlocation) throws Exception
	{
		// FIXME - Why not use setData instead of duplicating it here?

		if (id == null) id = uniqueSessionID();

		if (!checkAuth(db, id, sessionid, true)) throw new Exception("UNAUTHORIZED");
		
		JSONArray rs = readers == null ? new JSONArray() : new JSONArray(readers);
		JSONArray ws = writers == null ? new JSONArray() : new JSONArray(writers);
		
		Session s = getSession(sessionid);
		String username = (String)s.get("username");
		
		File root = getDB(db);
		SuperSimpleCipher[] keys = getKeys(db);
		boolean plaintext = keys.length == 0;
		String name = plaintext ? id : toHexString(keys[1].encrypt(id.getBytes()));
		root = getSubDir(root, name, 4, 4);
		root.mkdirs();

		JSONObject d = new JSONObject(data);
		if (plaintext && d.has("attachmentkeynames")) // FIXME - HACK
			STORE.saveAttachments(root, d, name);

		JSONObject jo = new JSONObject();
		jo.put("id", id);
		jo.put("data", d);
		jo.put("username", username);
		jo.remove("sessionid");
		jo.put("addr", sessionlocation);
		jo.put("time", System.currentTimeMillis());
		if (readers != null) jo.put("readers", rs);
		if (writers != null) jo.put("writers", ws);

		File f = new File(root, name);
		writeFile(f, plaintext ? jo.toString().getBytes() : keys[1].encrypt(jo.toString().getBytes()));
		
		jo.put("db", db);
		fireEvent("write", jo);
		
		jo = newResponse();
		jo.put("id", id);
		
		return jo;
	}

	private JSONObject handleJSearch(String db, String id, String java, String imports, String json, String javascript, String readers, String writers, String deletex, String sessionid, String sessionlocation) throws Exception
	{
		File jdb = getDB("jsearch");
		if (!jdb.exists() || !new File(jdb, "meta.json").exists())
		{
			handleNewdb("jsearch", null, "['admin']", "none", sessionid);
		}
		
		if (java != null)
		{
			if (id == null) id = uniqueSessionID();
			
			File f = new File(getRootDir(), "transform");
			f = new File(f, "com");
			f = new File(f, "newbound");
			f = new File(f, "generated");
			f = new File(f, "transform");
			f = new File(f, "jsearch");
			f = getSubDir(f, id, 4, 2);
			f.mkdirs();
			f = new File(f, id+".java");
			
			File f2 = f.getParentFile();
			String pkg = f2.getName();
			f2 = f2.getParentFile();
			pkg = "com.newbound.generated.transform.jsearch."+f2.getName()+"."+pkg;
			
			String s = "package "+pkg+";\r";
			s += "import org.json.*;\rimport com.newbound.robot.*;\r";
			if (imports != null)
			{
				JSONArray ja = new JSONArray(imports);
				int i = ja.length();
				while (i-->0) s += "import "+ja.getString(i)+";\r";
			}
			s += "public class "+id+" extends BotUtil implements JSONTransform{\r";
			s += "public JSONObject execute(JSONObject data){\rJSONObject params = data.getJSONObject(\"params\");\rdata = data.getJSONObject(\"data\");\r";
			s += java;
			s += "\r}\r}\r";
			
			writeFile(f, s.getBytes());
			
			String classname = pkg+"."+id;
			String err = SYS.compileClass(new File(getRootDir(), "transform"), classname);
			if (!err.equals(""))  throw new Exception(err);
			
			JSONObject search = new JSONObject();
			if (db != null) search.put("db", db);
			search.put("java", java);
			search.put("classname", classname);
			if (javascript != null) search.put("javascript", javascript);
			handleWrite("jsearch", search.toString(), id, readers, writers, sessionid, sessionlocation);
		}
		
		JSONObject out = newResponse();
		out.put("id", id);
		
		if (json != null)
		{
			JSONObject search = getData("jsearch", id);
			search = search.getJSONObject("data");
			if (search.has("db")) db = search.getString("db");
			
			if (!checkAuth(db, sessionid, false)) throw new Exception("UNAUTHORIZED");
			
			String classname = search.getString("classname");
			JSONObject o = new JSONObject(json);
			JSONTransform t = (JSONTransform)SYS.loadClass(new File(getRootDir(), "transform"), classname, false).newInstance();
			JSONArray data = searchData(db, t, o, sessionid);
			out.put("data", data);
			
			if (search.has("javascript")) out.put("javascript", javascript);
		}
		
		return out;
	}

	public JSONObject handleRead(String db, String id, String sessionid) throws Exception
	{
		if (!checkAuth(db, id, sessionid, false)) 
			throw new Exception("UNAUTHORIZED");
		
		JSONObject jo = getData(db, id);
		
		jo.remove("id");
		jo.put("status", "ok");
		
		return jo;
	}

	public JSONObject handleDelete(String db, String id, String sessionid) throws Exception
	{
		if (!checkAuth(db, id, sessionid, true)) throw new Exception("UNAUTHORIZED");
		
		JSONObject jo = deleteData(db, id);
		
//		jo.remove("id");
//		jo.put("status", "ok");
		
		return jo;
	}

	private boolean checkAuth(String db, String sessionid, boolean iswrite) throws Exception
	{
	  File f = getDB(db);
	  if (!f.exists()) throw new Exception("No such database: "+db);
	  
	  f = new File (f, "meta.json");
	  byte[] ba = readFile(f);
	  JSONObject jo = new JSONObject(new String(ba));
	
	  return checkAuth(jo, sessionid, iswrite);
	}
	
	private boolean checkAuth(String db, String id, String sessionid, boolean iswrite) throws Exception
	{
	  if (checkAuth(db, sessionid, iswrite))
	  {
		File f = getDB(db);
		SuperSimpleCipher[] keys = getKeys(db);
		String name = keys.length == 0 ? id : toHexString(keys[1].encrypt(id.getBytes()));
		f = getSubDir(f, name, 4, 4);
		f = new File(f, name);
		
		if (!f.exists()) return true;
		byte[] ba = readFile(f);
		JSONObject jo = new JSONObject(new String(keys.length == 0 ? ba : keys[0].decrypt(ba)));
		
		return checkAuth(jo, sessionid, iswrite);
	  }
	  
	  return false;
	}
	
	private boolean checkAuth(JSONObject jo, String sessionid, boolean iswrite) throws Exception
	{
	  String type = iswrite ? "writers" : "readers";
	  Session s = getSession(sessionid);

	  String username = (String)s.get("username");
	  boolean isok = false;

	  Properties user = (Properties)s.get("user");
	  String gs = user == null ? "anonymous" : user.getProperty("groups");
	  if (gs == null) gs = "anonymous";
	  
	  String[] sa = gs.split(",");
	  int i = sa.length;
	  while (i-->0) if (sa[i].equals("admin")) return true;

	  if (username != null && jo.has("username") && !username.equals("anonymous") && jo.getString("username").equals(username)) isok = true;
	  else if (jo.has(type)){
		JSONArray ows = jo.getJSONArray(type);
		if (gs != null && !gs.equals(""))
		{
		  i = sa.length;
		  while (i-->0)
		  {
		  	int j = ows.length();
			while (j-->0)
			{
			  String perm = (String)ows.get(j);
			  isok = perm.equals(sa[i]) || perm.equals("anonymous");
			  if (isok) break;
			}
			if (isok) break;
		  }
		}
	  }
	  
	  return isok;
	}
	
	public File getDB(String id)
	{
	  return STORE.getDB(id);
	}
	
	protected SuperSimpleCipher[] getKeys(String db) throws Exception
	{
	  return STORE.getKeys(db);
	}
	
	public JSONArray listDataIDs(String db) throws Exception
	{
		  File f = getDB(db);
		  SuperSimpleCipher[] keys = getKeys(db);
		  JSONArray ja = new JSONArray();
		  listDataIDs(f, ja, keys.length == 0 ? null : keys[0]);
		  return ja;
	}
	
	public void listDataIDs(File f, JSONArray ja, SuperSimpleCipher key) throws Exception
	{
		String[] sa = f.list();
		int i = sa.length;
		while (i-->0)
		{
			String s = sa[i];
			if (!s.startsWith(".") && !s.equals("meta.json"))
			{
				File f2 = new File(f, s);
				if (f2.isDirectory()) listDataIDs(f2, ja, key);
				else 
				{
					String name = key == null ? s : new String(key.decrypt(s.getBytes()));
					ja.put(name);
				}
			}
		}
	}

	public JSONArray searchData(String db, JSONTransform t, JSONObject params, String sessionid) throws Exception
	{
		  File f = getDB(db);
		  SuperSimpleCipher[] keys = getKeys(db);
		  JSONArray ja = new JSONArray();
		  JSONObject query = new JSONObject();
		  query.put("params", params);
		  searchData(f, t, query, ja, keys.length == 0 ? null : keys[0], sessionid);
		  return ja;
	}
	
	public void searchData(File f, JSONTransform t, JSONObject query, JSONArray ja, SuperSimpleCipher key, String sessionid) throws Exception
	{
		String[] sa = f.list();
		int i = sa.length;
		while (i-->0)
		{
			String s = sa[i];
			if (!s.startsWith(".") && !s.equals("meta.json"))
			{
				File f2 = new File(f, s);
				if (f2.isDirectory()) searchData(f2, t, query, ja, key, sessionid);
				else try
				{
					byte[] ba = readFile(f2);
					JSONObject jo = new JSONObject(new String(key == null ? ba : key.decrypt(ba)));
					if (sessionid == null || checkAuth(jo, sessionid, false))
					{
						query.put("data", jo);
						jo = t.execute(query);
						if (jo != null) ja.put(jo);
					}
				}
				catch (Exception x) { x.printStackTrace(); }
			}
		}
	}
	
	public boolean newDB(String db, JSONArray readers, JSONArray writers) throws Exception 
	{
		File f = getDB(db);
		if (f.exists()) throw new Exception("That database already exists");
		
		f.mkdirs();
		JSONObject meta = new JSONObject();
		meta.put("id", db);
		meta.put("username", "system");
		if (readers != null) meta.put("readers", readers);
		if (writers != null) meta.put("writers", writers);
//		byte[] writekey = SuperSimpleCipher.getSeed(SuperSimpleCipher.KEYSIZE);
//		String crypt = toHexString(writekey);
//		meta.put("crypt", crypt);
		f = new File (f, "meta.json");
		writeFile(f, meta.toString().getBytes());
		
//		SuperSimpleCipher sscw = new SuperSimpleCipher(writekey, true);
//		SuperSimpleCipher sscr = new SuperSimpleCipher(writekey, false);
//		SuperSimpleCipher[] ssca = new SuperSimpleCipher[2];
//		ssca[0] = sscr;
//		ssca[1] = sscw;
//		KEYS.put(db, ssca);
		
		fireEvent("newdb", meta);
		
		return true;		
	}

	public boolean setData(String db, String id, JSONObject data, JSONArray readers, JSONArray writers) throws Exception
	{
		return STORE.setData(db, id, data, readers, writers);
	}

	public boolean hasData(String db, String id) throws Exception
	{
		SuperSimpleCipher[] keys = getKeys(db);
		File f = getDataFile(db, id, keys);
		return f.exists();
	}

	public JSONObject getData(String db, String id) throws Exception
	{
		return STORE.getData(db, id);
	}

	protected File getDataFile(String db, String id, SuperSimpleCipher[] keys) throws Exception
	{
		return STORE.getDataFile(db, id, keys);
	}

	public JSONObject deleteData(String db, String id) throws Exception
	{
	  STORE.deleteData(db, id);
	  return newResponse();
	}

	public JSONObject handleEvents(String id) throws Exception
	{
		BotBase bb = getBot(id);
		String[] sa = bb.getEventNames();
		JSONObject jo = newResponse();
		jo.put("list",new JSONArray(sa));
		return jo;
	}

	public JSONObject handleEvent(String id, String mode, String params) throws Exception
	{
		if (mode.equals("set")) {
			JSONObject jo = (JSONObject)mEvents.get(id);
			if (jo != null)
			{
				String bot = jo.getString("bot");
				String event = jo.getString("event");
				Callback cb = (Callback)jo.get("cb");
				getBot(bot).removeEventListener(event, cb);
			}
			jo = new JSONObject(params);
			String bot = jo.getString("bot");
			String event = jo.getString("event");
			String cmddb = jo.getString("cmddb");
			String cmd = jo.getString("cmd");

			JSONObject jo2 = BotBase.getBot("botmanager").getData(cmddb, cmd).getJSONObject("data");
			final Code code = new Code(jo2, cmddb);
			Callback cb = new Callback() {
				@Override
				public void execute(JSONObject data) {
					try
					{
						code.execute(data);
					}
					catch (Exception x) { x.printStackTrace(); }
				}
			};

			jo.put("cb", cb);
			mEvents.put(id, jo);
			getBot(bot).addEventListener(event, cb);
			return newResponse();
		}
		if (mode.equals("list"))
		{
			JSONObject jo = newResponse();
			jo.put("data", new JSONObject(mEvents));
			return jo;
		}
		if (mode.equals("get"))
		{
			JSONObject jo = mEvents.get(id);
			if (jo == null) throw new Exception("No such event: "+id);
			return jo;
		}
		if (mode.equals("kill"))
		{
			JSONObject jo = (JSONObject)mEvents.remove(id);
			if (jo == null) throw new Exception("No such event: "+id);
			String bot = jo.getString("bot");
			String event = jo.getString("event");
			Callback cb = (Callback)jo.get("cb");
			getBot(bot).removeEventListener(event, cb);
			return newResponse();
		}
		throw new Exception("Unsupported mode: "+mode);
	}

	public JSONObject handleTimer(String id, String mode, String params) throws Exception
	{
		File f = new File(getRootDir(), "timer");
		f.mkdirs();
		
		if (mode.equals("set"))
		{
			if (id == null) id = uniqueSessionID();
			JSONObject jo = new JSONObject(params);
			
			mTimer.set(id, jo);
			
			f = new File(f, id+".json");

			writeFile(f, jo.toString().getBytes());
			
			jo = newResponse();
			jo.put("id", id);
			
			return jo;
		}
		
		if (mode.equals("get"))
		{
			f = new File(f, id+".json");
			JSONObject jo = new JSONObject(new String(readFile(f)));
			return jo;
		}
		
		if (mode.equals("list"))
		{
			String[] sa = f.list();
			int n = sa.length;
			int i;
			JSONArray ja = new JSONArray();
			for (i=0;i<n;i++)
			{
				id = sa[i];
				if (id.endsWith(".json"))
				{
					File f2 = new File(f, sa[i]);
					JSONObject jo = new JSONObject(new String(readFile(f2)));
					jo.put("id", sa[i].substring(0, sa[i].lastIndexOf('.')));
					ja.put(jo);
				}
			}
			JSONObject jo = newResponse();
			jo.put("list",  ja);
			return jo;
		}
		
		if (mode.equals("kill"))
		{
			f = new File(f, id+".json");
			f.delete();
			mTimer.kill(id);
			return newResponse();
		}
		
		throw new Exception("Unsupported mode");
	}
	
	public JSONObject handleSaveJava(String db, String id, String cmd, String java, String params, String imports, String returntype, String readers, String writers, String sessionidx) throws Exception
	{
		JSONArray p = new JSONArray(params == null ? "[]" : params);
		JSONArray rs = readers == null ? null : new JSONArray(readers);
		JSONArray ws = writers == null ? null : new JSONArray(writers);
		return Code.buildJava(db, id, cmd, java, p, imports, returntype, rs, ws);
	}
	
	public JSONObject handleCompile(String db, String id, String cmd, String java, String python, String js, String flow, String rust, String params, String imports, String returntype, String readers, String writers, String sessionidx) throws Exception
	{
		JSONObject jo = null;
		if (python != null) jo = handleSavePython(db, id, cmd, python, params, imports, returntype, readers, writers, sessionidx);
		if (js != null) jo = handleSaveJavascript(db, id, cmd, js, params, imports, returntype, readers, writers, sessionidx);
		if (flow != null) jo = handleSaveFlow(db, id, cmd, flow, params, imports, returntype, readers, writers, sessionidx);
		if (rust != null) jo = handleSaveRust(db, id, cmd, rust, params, imports, returntype, readers, writers, sessionidx);
		if (java != null)
		{
			jo = handleSaveJava(db, id, cmd, java, params, imports, returntype, readers, writers, sessionidx);
			new Code(jo, db).precompile();
		}

		if (jo == null) throw new Exception("No readable code");

		jo.put("cmd", cmd);
		
		return jo;
	}

	private JSONObject handleSaveRust(String db, String id, String cmd, String code, String params, String imports, String returntype, String readers, String writers, String sessionidx) throws Exception {
//		String homepath = PROPERTIES.getProperty("rust_home");
//		if (homepath == null) throw new Exception("No home directory set for Rust. Add 'rust_home' to runtime/botmanager/botd.properties and restart.");

		JSONObject jo = getData(db, cmd).getJSONObject("data");
		String ctl = jo.getString("ctl");
		String cmdname = jo.getString("cmd");

		if (!LIBFLOW) {
			String[] sa = {"target/debug/newboundb", db, ctl, cmdname};
//		File home = new File(homepath);
//		Process bogoproc = Runtime.getRuntime().exec(sa, null, home);
			Process bogoproc = Runtime.getRuntime().exec(sa, null, null);
			sa = systemCall(bogoproc, (InputStream) null);

			ByteArrayInputStream bais = new ByteArrayInputStream(sa[1].getBytes());
			BufferedReader br = new BufferedReader(new InputStreamReader(bais));
			String err = "";
			String line;
			while ((line = br.readLine()) != null) {
				if (line.startsWith("thread 'main' panicked")) {
					err += line + "\n";
					while ((line = br.readLine()) != null) {
						err += line + "\n";
						if (line.equals("")) break;
					}
				}
			}
			if (!err.equals("")) throw new Exception(err);
		}
		else {
			String result = LibFlow.build(db, ctl, cmdname);
			if (!result.equals("OK")) throw new Exception(result);
		}

		String[] sa = new String[] {"cargo", "build" };
//		bogoproc = Runtime.getRuntime().exec(sa, null, home);
		Process bogoproc = Runtime.getRuntime().exec(sa, null, null);
		sa = systemCall(bogoproc, (InputStream) null);

		ByteArrayInputStream bais = new ByteArrayInputStream(sa[1].getBytes());
		BufferedReader br = new BufferedReader(new InputStreamReader(bais));
		String err = "";
		String line;
		while ((line = br.readLine()) != null)
		{
			if (line.startsWith("error"))
			{
				err += line + "\n";
				while ((line = br.readLine()) != null)
				{
					err += line + "\n";
					if (line.equals("")) break;
				}
			}
		}

		if (!err.equals("")) throw new Exception(err);

		return newResponse();
	}

	private JSONObject handleSaveFlow(String db, String id, String cmd, String code, String params, String imports, String returntype, String readers, String writers, String sessionidx) {
		return newResponse();
	}

	private JSONObject handleSaveJavascript(String db, String id, String cmd, String code, String params, String imports, String returntype, String readers, String writers, String sessionidx) {
		return newResponse();
	}

	private JSONObject handleSavePython(String db, String id, String cmd, String python, String params, String imports, String returntype, String readers, String writers, String sessionidx) throws Exception
	{
		JSONArray p = new JSONArray(params == null ? "[]" : params);

		File home = getRootDir().getParentFile().getParentFile();
		File root = new File(home, "generated");
		root.mkdirs();

		File f = new File(home, "lib_python");
		f.mkdirs();
		String PYTHONPATH = f.getCanonicalPath();

		if (returntype == null) returntype = "JSONObject";
		if (imports == null) imports = "import sys\rimport json\r";
		else imports = imports.replace('\n', '\r');
		
		int n = p.length();
		int i;
		String top = "";
		String bottom = "";
		String invoke = "";
		String invoke2 = "args = json.loads(sys.stdin.read())\n";
		String invoke3 = "";
		for (i=0;i<n;i++)
		{
			if (!invoke.equals("")) invoke += ", ";
			if (!invoke3.equals("")) invoke3 += ", ";

			JSONObject o = p.getJSONObject(i);
			String name = o.getString("name");
			invoke += "arg"+(i+1);
			invoke2 += "arg"+(i+1)+" = args['"+name+"']\r";
			invoke3 += name;
		}
		
		f = new File(root, "com");
		f = new File(f, "newbound");
		f = new File(f, "robot");
		f = new File(f, "published");
		f = new File(f, db);
//		f = new File(f, "code");
		f.mkdirs();

		File f2 = new File(f, id+"-f.py");
		f = new File(f, id+".py");

		String loadpath = "import sys\rsys.path.append(\""+PYTHONPATH+"\")\r\r";
		
		String code =
			loadpath
			+ imports
			+ "\rdef "+id+"("+invoke3+"):\r"
			+ indent(python, 2)+"\r"
			+ invoke2+"\r"
			+ "val = { 'status':'ok', 'data': "
			+ id+"("+invoke+") }\rprint(json.dumps(val))\r";

		writeFile(f, code.getBytes());

		code =
			loadpath
			+ imports
			+ "\rdef execute(args):\r  return "+id+"(**args)\r"
			+ "\rdef "+id+"("+invoke3+"):\r"
			+ indent(python, 2)+"\r";

		writeFile(f2, code.getBytes());

		JSONObject data = new JSONObject();
		try  { data = getData(db, id).getJSONObject("data"); } catch (Exception x) {}
		int hash = data.toString().hashCode();
		data.put("lang", "python");
		data.put("id", id);
		data.put("cmd", cmd);
		data.put("python", cmd);
		if (data.toString().hashCode() != hash)
			setData(db, id, data, readers == null ? null : new JSONArray(readers), writers == null ? null : new JSONArray(writers));
		data.put("status", "ok");
		return data;
	}

	private String indent(String s, int i) throws IOException 
	{
		BufferedReader br = new BufferedReader(new StringReader(s));
		String news = "";
		String indent = "";
		while (i-->0) indent += " ";
		String oneline;
		while ((oneline = br.readLine()) != null) news += indent + oneline + "\r";
		br.close();
		return news;
	}

	public Object handleExecute(String db, String id, JSONObject args, String sessionid) throws Exception
	{
		args.put("sessionid", sessionid);
		JSONObject src = handleRead(db, id, sessionid).getJSONObject("data");
		Code code = new Code(src, db);
		JSONObject jo = code.execute(args);
		if (code.TYPE.equals("flow") || code.TYPE.equals("rust"))
		{
			if (code.RETURNTYPE.equals("FLAT"))
			{
				if (!jo.has("status")) jo.put("status", "ok");
			}
			else if (code.RETURNTYPE.equals("JSONObject"))
			{
				JSONObject jo2 = newResponse();
				Object o = jo.get("a");
				if (o instanceof JSONObject) jo2.put("data", o);
				else jo2.put("data", new JSONObject(o));
				return jo2;
			}
			else return jo.get("a");
		}
		else if (jo.has("data"))
		{
			Object o = jo.get("data");
			if (o instanceof File || o instanceof InputStream || o instanceof String) return o;
		}
		return jo;
	}

	public void softStart() throws Exception
	{
		OFF = false;
		RUNNING = true;
		SYS.RUNNING = true;
		mMasterBot = this;
		init();
	}

	private synchronized Object handleDiscover() throws Exception {

		JSONObject o = new JSONObject();
		 
		// Find the server using UDP broadcast
		try {
		  //Open a random port to send the package
		  DatagramSocket c = new DatagramSocket();
		  c.setBroadcast(true);
		 
		  byte[] sendData = "DISCOVER".getBytes();
		 
		  //Try the 255.255.255.255 first
		  try {
		    DatagramPacket sendPacket = new DatagramPacket(sendData, sendData.length, InetAddress.getByName("255.255.255.255"), 5772);
		    c.send(sendPacket);
		  } catch (Exception e) {}
		 
		  // Broadcast the message over all the network interfaces
		  Enumeration interfaces = NetworkInterface.getNetworkInterfaces();
		  while (interfaces.hasMoreElements()) {
		    NetworkInterface networkInterface = (NetworkInterface)interfaces.nextElement();
		 
		    if (networkInterface.isLoopback() || !networkInterface.isUp()) {
		      continue; // Don't want to broadcast to the loopback interface
		    }
		 
		    for (InterfaceAddress interfaceAddress : networkInterface.getInterfaceAddresses()) {
		      InetAddress broadcast = interfaceAddress.getBroadcast();
		      if (broadcast == null) {
		        continue;
		      }
		 
		      // Send the broadcast package!
		      try {
		        DatagramPacket sendPacket = new DatagramPacket(sendData, sendData.length, broadcast, 5772);
		        c.send(sendPacket);
		      } catch (Exception e) {
		      }
		 
//		      System.out.println(getClass().getName() + ">>> Request packet sent to: " + broadcast.getHostAddress() + "; Interface: " + networkInterface.getDisplayName());
		    }
		  }
		 
//		  System.out.println(getClass().getName() + ">>> Done looping over all network interfaces. Now waiting for a reply!");
		 
		  //Wait for a response
		  c.setSoTimeout(5000);
		  Vector v = new Vector();
		  while (true) try
		  {
		    byte[] recvBuf = new byte[15000];
		    DatagramPacket receivePacket = new DatagramPacket(recvBuf, recvBuf.length);
		    c.receive(receivePacket);
		  
		    //We have a response
//		    System.out.println(getClass().getName() + ">>> Broadcast response from server: " + receivePacket.getAddress().getHostAddress());
		  
		    String message = new String(receivePacket.getData()).trim()+"="+receivePacket.getAddress();
		    if (v.indexOf(message) == -1) 
		    { 
		      v.addElement(message);
		      JSONObject jo = new JSONObject(new String(receivePacket.getData()).trim());
		      String uuid = jo.getString("uuid");
		      if (!uuid.equals(getLocalID()))
		      {
				  P2PPeer p = PeerBot.getPeerBot().getPeer(uuid, false, false);
			      if (!o.has(uuid)) o.put(uuid, jo);
			      else jo = o.getJSONObject(uuid);
			      String addr = receivePacket.getAddress().getHostAddress();
				  if (p != null) p.addOtherAddress(addr);
			      if (!jo.has("address"))
			      {
			        jo.put("address", new JSONArray());
			 
			        try
			        {
			        	// FIXME - Port should be sent in discovery service
			          String id = download("http://"+addr+":"+5773+"/peerbot/getpeerinfo?sessionid=discovery_"+getLocalID());
			          JSONObject o2 = new JSONObject(id);
			          jo.put("peerinfo", o2);
			          jo.put("port", 5773);
			        }
			        catch (Exception x) 
			        {
			          try
			          {
			            String id = download("http://"+addr+":"+5774+"/peerbot/getpeerinfo");
			            JSONObject o2 = new JSONObject(id);
			            jo.put("peerinfo", o2);
			            jo.put("port", 5774);
			          }
			          catch (Exception x2) 
			          {
			            //System.out.println("No discovery at "+addr+": "+x.getMessage());
			          }
			        }
			      }
			      jo.getJSONArray("address").put(addr);
			    }
		    }
		  }
		  catch (SocketTimeoutException x) 
		  { 
		    break; 
		  }
		  //Close the port!
		  c.close();
		} catch (IOException ex) {
		  ex.printStackTrace();
		}
		 
		JSONArray ja = new JSONArray();
		Iterator<String> i = o.keys();
		while (i.hasNext()) ja.put(o.get(i.next()));
		
		PeerBot.getPeerBot().update(ja);
		 
		JSONObject jo = newResponse();
		jo.put("data", ja);
		return jo;

    }
	
	private JSONObject handlePrimitives() 
	{
		return Code.PRIMS;
	}

	public String systemSessionID() 
	{
		if (mSystemSessionID == null)
		{
			mSystemSessionID = uniqueSessionID();
		}
		
		Session ses = getSession(mSystemSessionID, true);
		ses.put("username", "SYSTEM");
		Properties p = new Properties();
		p.setProperty("groups", "admin");
		ses.put("user",  p);

		return mSystemSessionID;
	}

	public String getProperty(String string) 
	{
		return PROPERTIES.getProperty(string);
	}

	public JSONObject handleSaveCode(String lang, String db, String id, String cmd, String code, String params, String imports, String returntype, String readers, String writers, String sessionidx) throws Exception 
	{
		if (lang.equals("java")) return handleSaveJava(db, id, cmd, code, params, imports, returntype, readers, writers, sessionidx);
		else if (lang.equals("python")) return handleSavePython(db, id, cmd, code, params, imports, returntype, readers, writers, sessionidx);
		else if (lang.equals("js")) return handleSaveJavascript(db, id, cmd, code, params, imports, returntype, readers, writers, sessionidx);
		throw new Exception("Unknown Language: "+lang);
	}

/*
	public void addJob(Runnable o, String s) 
	{
		super.addJob(o, s);
	}
	
	public void addPeriodicTask(PeriodicTask pt)
	{
		super.addPeriodicTask(pt);
	}
	
	public void addPeriodicTask(final Runnable r, long millis, String name, final IsRunning ir)
	{
		super.addPeriodicTask(r, millis, name, ir);
	}
	
	public void addNumThreads(int numToAllocate)
	{
		super.addNumThreads(numToAllocate);
	}

	public void removeNumThreads(int numToRemove)
	{
		super.removeNumThreads(numToRemove);
	}
*/
}
