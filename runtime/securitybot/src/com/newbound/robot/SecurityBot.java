package com.newbound.robot;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Properties;
import java.util.Vector;

import com.newbound.net.service.http.Exception404;
import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.robot.BotBase;

public class SecurityBot extends BotBase 
{
	public String DB() { return "securitybot"; }
	public String ID() { return "gsiyox15d328c87f0y7"; }

	public Object handleCommand(String cmd, Hashtable params) throws Exception
	{
		if (cmd.equals("deviceinfo")) return handleGetSettings(params, 1);
		if (cmd.equals("listusers")) return handleListUsers(params);
		if (cmd.equals("listgroups")) return handleListGroups(params);
		if (cmd.equals("updateuser")) return handleUpdateUser(params);
		if (cmd.equals("newuser")) return handleNewUser(params);
		if (cmd.equals("deleteuser")) return handleDeleteUser(params);
		if (cmd.equals("listapps")) return handleListApps(params);
		if (cmd.equals("updateapp")) return handleUpdateApp(params);
		if (cmd.equals("resetapps")) return handleResetApps(params);
		if (cmd.equals("currentuser")) return handleCurrentUser(params);
		throw new Exception("No such command: "+cmd);
	}

	public JSONObject getCommands()
	{
		JSONObject commands = new JSONObject();
		JSONObject cmd;
		
		cmd = new JSONObject();
		cmd.put("parameters", new JSONArray("[\"requirepassword\",\"syncapps\"]"));
		cmd.put("desc", "All parameters are optional. Get or set basic security parameters. Turn security on or off, turn permission synching to defaults for apps on or off.");
		commands.put("deviceinfo", cmd);

		cmd = new JSONObject();
		cmd.put("desc", "List all users and peers. The &quot;local&quot; attribute is true for users and false for peers.");
		commands.put("listusers", cmd);

		cmd = new JSONObject();
		cmd.put("desc", "List all security groups.");
		commands.put("listgroups", cmd);

		cmd = new JSONObject();
		cmd.put("parameters", new JSONArray("[\"username\",\"displayname\",\"password\",\"groups\"]"));
		cmd.put("desc", "Set basic information about the user.");
		commands.put("updateuser", cmd);

		cmd = new JSONObject();
		cmd.put("parameters", new JSONArray("[\"username\",\"realname\",\"password\",\"groups\"]"));
		cmd.put("desc", "Create a new user.");
		commands.put("newuser", cmd);

		cmd = new JSONObject();
		cmd.put("parameters", new JSONArray("[\"username\"]"));
		cmd.put("desc", "Delete a user.");
		commands.put("deleteuser", cmd);

		cmd = new JSONObject();
		cmd.put("desc", "List all apps and their current security settings.");
		cmd.put("groups", "anonymous");
		commands.put("listapps", cmd);

		cmd = new JSONObject();
		cmd.put("parameters", new JSONArray("[\"include\",\"exclude\",\"id\",\"cmd\"]"));
		cmd.put("desc", "Update the security settings for an app. All parameters are optional except id, which is the ID of the app you are updating. The include and exclude parameters are comma separated lists of groups. If the cmd parameter is passed, the include and exclude settings will be applied to that command. Otherwise, the settings will be applied to the app itself.");
		commands.put("updateapp", cmd);

		cmd = new JSONObject();
		cmd.put("desc", "Reset all apps to their default security settings.");
		commands.put("resetapps", cmd);

		cmd = new JSONObject();
		cmd.put("desc", "Return information about the current user.");
		commands.put("currentuser", cmd);

		return commands;
	}

	private JSONObject handleCurrentUser(Hashtable params) throws Exception
	{
		JSONObject result = newResponse();
		Session s = getSession(params);
//		JSONObject user = new JSONObject((Properties)s.get("user"));
//		result.put("data", user);
		
		Properties p = (Properties)s.get("user");
		result.put("displayname", p == null ? "Anonymous" : p.getProperty("displayname"));
		result.put("username", p == null ? "anonymous" : s.get("username"));
		result.put("groups", p == null ? "anonymous" : p.get("groups"));
		
		return result;
	}
	
	private Object handleResetApps(Hashtable params) throws Exception
	{
		new File(getRootDir(), "autoconfig.properties").delete();
		deleteDir(new File(getRootDir(), "rules"));
		setDefaults();
		
		return "OK";
	}
	
	protected JSONObject handleGetSettings(Hashtable params, int y) throws Exception 
	{
		JSONObject s = super.handleGetSettings((String)params.get("machineid"), (String)params.get("portnum"), (String)params.get("requirepassword"), (String)params.get("syncapps"), (String)params.get("password"));
		String syncapps = (String)params.get("syncapps");
		if (syncapps != null && syncapps.equals("true")) handleResetApps(params);
		return s;
	}
	private Object handleUpdateApp(Hashtable params) throws Exception
	{
		JSONObject o = newResponse();
		Properties p = new Properties();
		
		String[] grouptypes = { "include", "exclude" };
		int i = grouptypes.length;
		while (i-->0) 
		{
			String s = (String)params.get(grouptypes[i]);
			if (s != null && !s.equals(""))
			{
				String[] sa = s.split(",");
				int j = sa.length;
				while (j-->0) 
				{
					o.put(sa[j], grouptypes[i]);
					p.setProperty(sa[j], grouptypes[i]);
				}
			}
		}
		
		File f = new File(getRootDir(), "rules");
		File f2 = new File(f,(String)params.get("id"));
		String cmd = (String)params.get("cmd");
		if (cmd != null) f2 = new File(f2,cmd);
		f2.mkdirs();
		f2 = new File(f2,"groups.properties");

		storeProperties(p, f2);
		
		fireEvent("appupdate", o);

		return o;
	}

	private Object handleDeleteUser(Hashtable params) throws Exception
	{
		File f = new File(getRootDir(), "users");
		File f2 = new File(f,(String)params.get("username")+".properties");
		
		if (!f2.delete()) throw new Exception("Unable to delete user "+params.get("username"));

		JSONObject o = newResponse();
		o.put("user", (String)params.get("username"));
		
		fireEvent("deleteuser", o);
		
		return o;
	}

	private Object handleNewUser(Hashtable params) throws Exception
	{
		String username = (String)params.get("username");
		if (username == null) throw new Exception("username is required");

		JSONObject o = newResponse();
		File f = new File(getRootDir(), "users");
		File f2 = new File(f,username+".properties");
		Properties p;
		boolean b = f2.exists();
		try { p = b ? loadProperties(f2) : new Properties(); } catch (Exception x) { p = new Properties(); }

		String s = (String)params.get("realname");
		if (s == null) s = username;
		o.put("displayname", s);
		p.setProperty("displayname", s);
		
		s = (String)params.get("password");
		if (s == null) s = uniqueSessionID();
		o.put("password", s);
		p.setProperty("password", s);

		s = (String)params.get("groups");
		if (s != null) 
		{
			o.put("groups", s);
			p.setProperty("groups", s);
		}
		
		storeProperties(p, f2);
		
		Session ses = getSessionByUsername((String)params.get("username"));
		if (ses != null) 
			ses.put("user", p);

		if (!b) fireEvent("newuser", o);
		if (b) fireEvent("userupdate", o);
		
		return o;
	}

	private Object handleUpdateUser(Hashtable params) throws Exception
	{
		JSONObject o = newResponse();
		File f = new File(getRootDir(), "users");
		File f2 = new File(f,(String)params.get("username")+".properties");
		Properties p = loadProperties(f2);
		String s = (String)params.get("displayname");
		if (s != null) 
		{
			o.put("displayname", s);
			p.setProperty("displayname", s);
		}
		s = (String)params.get("password");
		if (s != null) 
		{
			o.put("password", s);
			p.setProperty("password", s);
		}
		s = (String)params.get("groups");
		if (s != null) 
		{
			o.put("groups", s);
			p.setProperty("groups", s);
		}
		
		storeProperties(p, f2);
		
		Session ses = getSessionByUsername((String)params.get("username"));
		if (ses != null) 
			ses.put("user", p);
		
		fireEvent("userupdate", o);
		
		return o;
	}

	private JSONObject handleListApps(Hashtable params) throws Exception
	{
		JSONObject o = newResponse();
		JSONObject ja = new JSONObject();
		o.put("data", ja);
		Hashtable h = new Hashtable();
		h.putAll(mBots);
		h.put(mMasterBot.getServiceName(), mMasterBot);
		Enumeration<BotBase> e = h.elements();
		
		while (e.hasMoreElements())
		{
			BotBase b = e.nextElement();
			Properties p = b.getAppProperties();
			JSONObject bot = new JSONObject();
			bot.put("id", b.getServiceName());
			bot.put("name", p.getProperty("name"));
			bot.put("desc", p.getProperty("desc"));
			bot.put("forsale", p.getProperty("forsale"));
			bot.put("commands", b.getCommands());
			ja.put(b.getServiceName(), bot);
		}
		
		File f = new File(getRootDir(), "rules");
		f.mkdirs();
		String[] sa = f.list();
		int i;
		for(i=0;i<sa.length;i++) 
		{
			File f3 = new File(f,sa[i]);
			if (f3.exists() && f3.isDirectory() && ja.has(sa[i]))
			{
				JSONObject app = ja.getJSONObject(sa[i]);

				File f2 = new File(f3,"groups.properties");
				if (f2.exists())
				{
					extractGroupsForApp(f2, app);
				}
				if (!app.has("include")) app.put("include", new JSONArray());
				if (!app.has("exclude")) app.put("exclude", new JSONArray());
				
				JSONObject commands = app.getJSONObject("commands");
				String[] sa2 = f3.list();
				int j;
				for (j=0;j<sa2.length;j++)
				{
					
					JSONObject cmd = commands.getJSONObject(sa2[j]); // new JSONObject();
//					commands.put(sa2[j], cmd);

					f2 = new File(f3,sa2[j]);
					f2 = new File(f2,"groups.properties");
					if (f2.exists())
					{
						extractGroupsForApp(f2, cmd);
					}
					
					f2 = new File(f3,sa2[j]);
					f2 = new File(f2,"desc.html");
					
					if (f2.exists()) cmd.put("desc", new String(readFile(f2)));
				}
			}
		}

		
		
		return o;
	}
	
	private void extractGroupsForApp(File f2, JSONObject app) throws Exception
	{
		app.put("include", new JSONArray());
		app.put("exclude", new JSONArray());
		
		Properties p = loadProperties(f2);
		Enumeration e2 = p.keys();
		while (e2.hasMoreElements())
		{
			String key = (String)e2.nextElement();
			String val = p.getProperty(key);
			
			JSONArray grouptype;
			if (app.has(val)) grouptype = app.getJSONArray(val);
			else
			{
				grouptype = new JSONArray();
				app.put(val, grouptype);
			}
			grouptype.put(key);
		}
	}

	private void makeSurePeersAreUsers() throws Exception
	{
		BotBase bb = (BotBase)mBots.get("peerbot");
		JSONObject jo = (JSONObject)bb.handleCommand("connections", new Hashtable());
		JSONObject ja = jo.getJSONObject("data");
		Iterator<String> i = ja.keys();
		while (i.hasNext()) 
		{
			String id = i.next();
			JSONObject peer = ja.getJSONObject(id);
//			String id = peer.getString("id");
			createUser(id, peer.getString("name"), null);
		}
	}

	private void createUser(String id, String name, String groups) throws Exception
	{
		Properties u = getUser(id, true);
		if (!u.contains("displayname")) 
		{
			u.setProperty("displayname", name);
			if (groups != null) u.setProperty("groups", groups);
			saveUser(id, u);
		}
	}

	private Object handleListGroups(Hashtable params) throws Exception
	{
		JSONObject o = (JSONObject)handleListUsers(params);
		JSONArray a = o.getJSONArray("data");
		Vector<String> v = new Vector();
		v.addElement("anonymous");
		v.addElement("admin");
		int i = a.length();
		while (i-->0)
		{
			o = a.getJSONObject(i);
			JSONArray a2 = o.getJSONArray("groups");
			int i2 = a2.length();
			while (i2-->0)
			{
				String s = a2.getString(i2);
				if (!v.contains(s)) v.addElement(s);
			}
		}
		
		o = (JSONObject)handleListApps(params);
		o = o.getJSONObject("data");
		Iterator<String> it = o.keys();
		while (it.hasNext())
		{
			String key = it.next();
			JSONObject bot = o.getJSONObject(key);
			if (bot.has("include"))
			{
				a = bot.getJSONArray("include");
				i = a.length();
				while (i-->0)
				{
					String s = a.getString(i);
					if (!v.contains(s)) v.addElement(s);
				}
			}
			if (bot.has("exclude"))
			{
				a = bot.getJSONArray("exclude");
				i = a.length();
				while (i-->0)
				{
					String s = a.getString(i);
					if (!v.contains(s)) v.addElement(s);
				}
			}
			JSONObject cmds = bot.getJSONObject("commands");
			Iterator<String> it2 = cmds.keys();
			while (it2.hasNext())
			{
				key = it2.next();
				JSONObject cmd = cmds.getJSONObject(key);
				if (cmd.has("include"))
				{
					a = cmd.getJSONArray("include");
					i = a.length();
					while (i-->0)
					{
						String s = a.getString(i);
						if (!v.contains(s)) v.addElement(s);
					}
				}
				if (cmd.has("exclude"))
				{
					a = cmd.getJSONArray("exclude");
					i = a.length();
					while (i-->0)
					{
						String s = a.getString(i);
						if (!v.contains(s)) v.addElement(s);
					}
				}
			}
		}
		
		o = newResponse();
		o.put("data", new JSONArray(v));
		
		return o;
	}
	
	private Object handleListUsers(Hashtable params) throws Exception
	{
		makeSurePeersAreUsers();
		
		JSONObject o = newResponse();
		JSONArray ja = new JSONArray();
		o.put("data", ja);
		
		File f = new File(getRootDir(), "users");
		String[] sa = f.list();
		int i;
		for(i=0;i<sa.length;i++) 
		{
			if (sa[i].endsWith(".properties"))
			{
				JSONObject user = new JSONObject();
				user.put("username", sa[i].substring(0,sa[i].lastIndexOf('.')));

				File f2 = new File(f,sa[i]);
				Properties p = loadProperties(f2);
				Enumeration e = p.keys();
				while (e.hasMoreElements())
				{
					String key = (String)e.nextElement();
					String val = p.getProperty(key);
					if (key.equals("groups"))
					{
						String[] groups;
						if (!val.equals("")) groups = val.split(",");
						else groups = new String[0];
						user.put(key, toJSONArray(groups)); 
					}
					else user.put(key,val);
				}
				if (!user.has("groups")) user.put("groups", new JSONArray());
				boolean b = !PeerBot.hasPeer(user.getString("username"));
				user.put("local", b);
				
				ja.put(user);
			}
		}
		
		return o;
	}

	public String getServiceName() 
	{
		return "securitybot";
	}
	
	public void init() throws Exception 
	{
		super.init();
		
		File f = new File(getRootDir(), "users");
		if (!f.exists())
		{
			f.mkdirs();
			f = new File(f, "admin.properties");
			Properties p = new Properties();
			p.setProperty("password", "admin");
			p.setProperty("groups", "admin");
			p.setProperty("displayname", "System Administrator");
			FileOutputStream fos = new FileOutputStream(f);
			p.store(fos, "");
			fos.flush();
			fos.close();
			
			PROPERTIES.setProperty("groups", "admin,anonymous");
			PROPERTIES.setProperty("requirepassword", ""+SYS.requirePassword());

			saveSettings();
		}
		
		f = new File(getRootDir(), "rules");
		if (!f.exists())
		{
			f = new File(f, "peerbot");
			f = new File(f, "stream");
			f.mkdirs();
			f = new File(f, "groups.properties");
			Properties p = new Properties();
			p.setProperty("anonymous", "include");
			FileOutputStream fos = new FileOutputStream(f);
			p.store(fos, "");
			fos.flush();
			fos.close();
			
		}

		Runnable r = new Runnable() 
		{
			public void run() 
			{
				while (mMasterBot == null) try { Thread.sleep(100); } catch (Exception x) { x.printStackTrace(); }
				while (!mMasterBot.isRunning()) try { Thread.sleep(100); } catch (Exception x) { x.printStackTrace(); }
				try
				{
					String syncapps = PROPERTIES.getProperty("syncapps");
					if (syncapps == null || syncapps.equals("true")) handleResetApps(null);
					else setDefaults();
				}
				catch (Exception x) { x.printStackTrace(); }
			}
		};
		new Thread(r).start();
		
		makeSurePeersAreUsers();
	}

	private void setDefaults() throws Exception
	{
		File f = new File(getRootDir(), "autoconfig.properties");
		Properties p = f.exists() ? loadProperties(f) : new Properties();
		JSONObject apps = handleListApps(new Hashtable()).getJSONObject("data");
		Iterator<String> i = apps.keys();
		boolean b = false;
		while (i.hasNext())
		{
			String key = i.next();
			if (p.getProperty(key) == null)
			{
				b = true;
				p.setProperty(key, "x");
//				JSONObject app = apps.getJSONObject(key);
				BotBase bb = getBot(key);
				if (bb == null && key.equals(mMasterBot.getServiceName())) bb = mMasterBot;
				JSONObject cmds = bb.getCommands();
//							JSONObject cmds = app.getJSONObject("commands");
				Iterator<String> ii = cmds.keys();
				while (ii.hasNext())
				{
					String k2 = ii.next();
					JSONObject cmd = cmds.getJSONObject(k2);
					
					File f2 = getRulesFolder(key, k2);
					f2.mkdirs();

					if (cmd.has("desc"))
					{
						writeFile(new File(f2, "desc.html"), cmd.getString("desc").getBytes());
					}
					
					if (cmd.has("groups"))
					{
						String groups = cmd.getString("groups");
						String[] sa = groups.split(",");
						int iii = sa.length;
						while (iii-->0)
						{
							String group = sa[iii];
							File f3 = new File(f2, "groups.properties");
							Properties p2 = f3.exists() ? loadProperties(f3) : new Properties();
							p2.put(group, "include");
							storeProperties(p2, f3);
						}
					}
				}
			}
		}
		if (b) storeProperties(p, f);
	}

	protected JSONObject handleLogin(String username, String password, String sid) throws Exception
	{
//		String username = (String)params.get("user");
//		String password = (String)params.get("pass");
		
		if (username == null || password == null) throw new Exception("Invalid login attempt");
		
		Properties user = getUser(username, false);
		if (user == null) throw new Exception("Invalid login attempt");

		String s = user.getProperty("password");
		if (s != null && s.equals(password))
		{
//			String sid = (String)params.get("sessionid");
			if (sid == null) 
				sid = uniqueSessionID();
				
			Session ses = getSession(sid, true);

			ses.put("username", username);
			ses.put("user", user);
			ses.put("emailusername", username);
			ses.put("emailuser", user);
			
			JSONObject o = new JSONObject();
			o.put("user", username);
			o.put("sessionid", sid);
			fireEvent("login", o);
			
			o = new JSONObject();
			o.put("status", "ok");
			o.put("msg", "You are now logged in\", \"sessionid\": \""+sid);
			o.put("sessionid", sid);
			
			return o;
		}
		
		JSONObject o = new JSONObject();
		o.put("user", username);
		fireEvent("loginfail", o);
		
		throw new Exception("Invalid login attempt");
	}

	public JSONArray checkPassword(String user, String pass) throws Exception
	{
		Properties p = getUser(user);
		if (p != null)
		{
			String g = p.getProperty("groups");
			if (g != null && !g.equals(""))
			{
				JSONArray ja = new JSONArray(g.split(","));
				return ja;
			}
		}
		
		JSONArray ja = new JSONArray();
		ja.put("anonymous");
		return ja;
	}
	
	public Properties getUserProperties(String id, boolean create) throws IOException 
	{
		return getUser(id, create);
	}
	
	private Properties getUser(String id, boolean create) throws IOException 
	{
		File f = new File(getRootDir(), "users");
		f = new File(f, id+".properties");
		if (f.exists()) return loadProperties(f);
		
		if (create)
		{
			FileOutputStream fos = new FileOutputStream(f);
			Properties p = new Properties();
			p.setProperty("displayname", id);
			p.setProperty("password", uniqueSessionID());
			p.store(fos, "");
			fos.flush();
			fos.close();
	
			return p;
		}
		
		return null;
	}

	private Properties saveUser(String id, Properties p) throws IOException
	{
		Session s = getSession(id);
		if (s != null) s.put("user", p);
		
		File f = new File(getRootDir(), "users");
		f = new File(f, id+".properties");
		FileOutputStream fos = new FileOutputStream(f);
		p.store(fos, "");
		fos.flush();
		fos.close();
		
		return p;
	}

	protected Session getSession(Hashtable params)
	{
		String sid = (String)params.get("sessionid");
		System.out.println("Lookup session "+sid);
		if (sid != null) 
		{
			Session s = (Session)sessions.get(sid);
			return s;
		}
		return null;
	}

	public void validateRequest(BotBase bot, String cmd, Hashtable params) throws Exception  
	{
		int x = cmd.indexOf('/');
		if (x != -1) cmd = cmd.substring(0,x);

		if (cmd.equals("botmanager"))
			System.out.println("FIXME2");
		
		Properties user = null;
		String username = null;
		String sid = (String)params.get("sessionid");
		Session s = getSession(sid, true);
		
		try
		{
			user = (Properties)s.get("user");
			if (user == null)
			{
				File f = new File(getRootDir(), "session.properties");
				Properties p;
				if (f.exists()) 
				{
					p = loadProperties(f);
					username = p.getProperty(sid);
					if (username == null) username = (String)s.get("username");
		
					if (username != null)
					{
						user = getUser(username, false);
					}
				}
			}
			else username = (String)s.get("username");
		}
		catch (Exception e) { e.printStackTrace(); }
		
		if (user == null)
		{
			username = "anonymous";
			user = new Properties();
			user.setProperty("groups", "anonymous");
			user.setProperty("displayname", "Anonymous User");
			user.setProperty("password", "");
//			System.out.println("VALIDATE REQUEST: bot="+bot.getServiceName()+" cmd="+cmd+" user=anonymous");
		}

		s.put("username", username);
		s.put("user", user);
		if (s.get("emailusername") == null)
		{
			s.put("emailusername", username);
			s.put("emailuser", user);
		}
		
//		System.out.println("VALIDATE REQUEST: bot="+bot.getServiceName()+" cmd="+cmd+" user="+s.get("username"));
	
		String[] groups;
		String g = user.getProperty("groups");
		if (g != null) groups = g.split(",");
		else groups = new String[0];
		
		int i = groups.length;
		while (i-->0) if (groups[i].equals("admin"))
		{
			updateSessionTimeout(s);
			return;
		}
		
		File f = new File(getRulesFolder(bot.getServiceName()), "groups.properties");
		Properties p = loadProperties(f);
		boolean b = checkGroups(groups, p);
		
		f = new File(getRulesFolder(bot.getServiceName(), cmd), "groups.properties");
		p = loadProperties(f);
		if (p != null) b = b || checkGroups(groups, p);

//		if (cmd.equals("libstatus"))
//			System.out.println("VALIDATE REQUEST: bot="+bot.getServiceName()+" cmd="+cmd+" user="+user.getProperty("displayname")+" groups="+new JSONArray(groups)+" params="+new JSONObject(params));
		
		if (!b) {
			String s2 = bot.getServiceName()+" cmd="+cmd+" user="+user.getProperty("displayname")+" groups=";
			try { s2 += new JSONArray(groups); } catch (Exception x2) { s2 += x2.getMessage(); }
			try { s2 += " params="+new JSONObject(params); } catch (Exception x2) { s2 += x2.getMessage(); }

			if (!bot.getCommands().has(cmd)) throw new Exception404(cmd+" not found");
			throw new Exception("UNAUTHORIZED: bot="+s2);
		}
		
		if (s != null) updateSessionTimeout(s);
	}

	private File getRulesFolder(String bot, String cmd) 
	{
		File f = new File(getRulesFolder(bot), cmd);
		return f;
	}

	private boolean checkGroups(String[] groups, Properties rules) throws Exception
	{
		boolean include = false;
		boolean exclude = false;
		
		if (rules != null) 
		{
			String perm = rules.getProperty("anonymous");
			if (perm != null) {
				if (perm.equals("include")) include = true;
//				else exclude = true;
			}

			int i = groups.length;
			while (i-->0)
			{
				perm = rules.getProperty(groups[i]);
				if (perm != null)
				{
					if (perm.equals("include")) include = true;
					else if (perm.equals("exclude")) exclude = true;
				}
			}
		}
		if (exclude) throw new Exception("UNAUTHORIZED");
		return include;
	}

	private File getRulesFolder(String bot) 
	{
		File f = new File(getRootDir(), "rules");
		f = new File(f, bot);
		f.mkdirs();
		return f;
	}

	protected JSONObject handleRememberSession(String cmd, Hashtable params) throws IOException 
	{
		Session s = getSession(params);
		String user = (String)s.get("username");
		File f = new File(getRootDir(), "session.properties");
		Properties p;
		if (f.exists()) p = loadProperties(f);
		else p = new Properties();
		p.setProperty((String)params.get("sessionid"), user);
		storeProperties(p, f);
		
		String sid = (String)params.get("sessionid");
		JSONObject o = new JSONObject();
		try {
			o.put("status", "ok");
			o.put("msg", "You are now logged in, sessionid: \"" + sid);
			o.put("sessionid", sid);
		}
		catch (Exception x) { x.printStackTrace(); }
		return o;
	}
	
	public boolean requirePassword()
	{
		String requirepassword = PROPERTIES.getProperty("requirepassword");
		return (requirepassword != null && requirepassword.equals("true"));
	}

	protected Properties getUser(String user) throws IOException 
	{
		return getUser(user, false); 
	}

}
