package com.newbound.robot;

import java.io.*;
import java.security.KeyPair;
import java.util.*;

import com.newbound.code.Code;
import com.newbound.crypto.SuperSimpleCipher;
import com.newbound.net.service.http.Exception404;
import com.newbound.p2p.P2PConnection;
import com.newbound.p2p.P2PPeer;

import org.json.*;

public abstract class MetaBot extends BotBase
{
	protected static final Hashtable<String, Object> GLOBAL = new Hashtable(); 
	protected final Hashtable<String, Object> RUNTIME = new Hashtable(); 
	
	private static final int NUMMETABOTTHREADS = 5;
	private static Runnable UPDATETHREAD = null;
	
//	private long UPDATEMILLIS = 5l * 60l * 1000l;
	
	protected String DB = "taskbot";
	protected String ID = "rjvxkn1594bc321c2r2";
	protected String[] LIBRARIES = {};
	
	public String getServiceName() 
	{
		return "metabot";
	}

	public void init() throws Exception 
	{
		super.init();
/*		
		if (UPDATETHREAD == null) 
		{
			addNumThreads(NUMMETABOTTHREADS);

			UPDATETHREAD = buildUpdaterx();
			addPeriodicTask(UPDATETHREAD, UPDATEMILLIS, "AUTOUPDATE", new IsRunning() { public boolean isRunning() { return mMasterBot.isRunning(); } });
			setTimeout(UPDATETHREAD, "METABOT UPDATER", 20000l);
		}
		else
*/ 
			addNumThreads(1); // Everybody gets one

		File tempdir = newTempFile();
		
		JSONObject jo = app(getServiceName());
		JSONArray libraries = jo.getJSONArray("libraries");
		int i = libraries.length();
		while (i-->0) try
		{
			String lib = libraries.getString(i);
			JSONObject DATA = getData(lib, "tasklists").getJSONObject("data");
			
			rebuildLibrary(lib);
			startTimers(lib);
			
		}
		catch (Exception x)
		{
			x.printStackTrace();
		}

//		recompile();

		if (tempdir != null) deleteDir(tempdir);

	}

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
		System.out.println("rebuilding "+db+"/"+id);

		JSONArray cmds = jo.has("cmd") ? jo.getJSONArray("cmd") : null;
		int i,j;
		if (cmds != null) for (i=0;i<cmds.length();i++) try
		{
		  JSONObject cmd = cmds.getJSONObject(i);
		  String lang = cmd.has("lang") ? cmd.getString("lang") : "java";
		  String cmdid = cmd.getString(lang);
		  System.out.println("lang: "+lang+" / src: "+cmdid+" / "+"cmd: "+cmd.getString("id"));
		  JSONObject data = b.getData(db, cmdid).getJSONObject("data");
//		  System.out.println(data);
		  JSONArray params = data.has("params") ? data.getJSONArray("params") : new JSONArray();
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

							JSONArray params = meta.getJSONArray("params");

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
		com.newbound.robot.MetaBot mb = (com.newbound.robot.MetaBot)BotBase.getBot("metabot");

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
				
				String lang = cmd.has("lang") ? cmd.getString("lang") : "java";
				String java = cmd.getString(lang);
				JSONObject meta = publishData(lib, java, tmpdir);
			}
		}
	}

	private JSONObject publishData(String lib, String id, File tmpdir) throws Exception
	{
		BotManager bm = (BotManager)BotBase.getBot("botmanager");
		JSONObject ctl = getData(lib, id).getJSONObject("data");
		File ctlfile = bm.getDataFile(lib, id, bm.getKeys(lib));
		
		File sub4 = ctlfile.getParentFile();
		File sub3 = sub4.getParentFile();
		File sub2 = sub3.getParentFile();
		File sub1 = sub2.getParentFile();
		File dest = new File(tmpdir, sub1.getName());
		dest = new File(dest, sub2.getName());
		dest = new File(dest, sub3.getName());
		dest = new File(dest, sub4.getName());
		dest.mkdirs();
		dest = new File(dest, ctlfile.getName());
		
		copyFile(ctlfile, dest);
		
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
	          + " extends com.newbound.robot.MetaBot \r{\r	public "
	          + claz
	          + "()\r	{\r		super();\r		\r		DB = \""
	          + db
	          + "\";\r		ID = \""
	          + id
	          + "\";\r";
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
	        newjava += "	}\r	\r	public String getServiceName() \r	{\r		return \""
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

	public String handleShutdown(Hashtable params) throws Exception {
		JSONObject jo = newResponse();
//		jo.put("a", handleCommand("shutdown", params));
		jo.put("b", super.handleShutdown(params));
		return jo.toString();
	}
	
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
		return call(ID, cmd, params);
	}
	
	public JSONObject call(String ctl, String cmd, JSONObject params) throws Exception
	{
		return call(DB, ctl, cmd, params);
	}
	
	public JSONObject call(String db, String ctl, String cmd, JSONObject params) throws Exception
	{
//		return new JavaCommand(db, ctl, cmd).execute(params);

		String id = lookupCmdID(db, ctl, cmd);
		if (id == null) throw new Exception404("UNKNOWN COMMAND: "+cmd);

		BotManager bm = (BotManager)mMasterBot;
		String sid = params.has("sessionid") ? params.getString("sessionid") : uniqueSessionID();
		bm.getSession(sid, true);
		
// FIXME: why are we shallow copying a JSONObject instead of just passing it?
//		JSONObject src = getData(db, id).getJSONObject("data");
		JSONObject src = bm.handleRead(db, id, sid).getJSONObject("data"); 
		Code code = new Code(src, db);
		JSONObject args = new JSONObject();
		Iterator<String> i = params.keys();
		String s;
		while (i.hasNext()) try
		{
			s = i.next();
			args.put(s, params.get(s));
		}
		catch (Exception x) { x.printStackTrace(); }

		JSONObject jo = code.execute(args);
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

	public String getIndexFileName()
	{
		return "index.html";
	}

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
			JSONObject DATA = getData(DB, ID).getJSONObject("data");
			JSONArray ja = DATA.has("cmd") ? DATA.getJSONArray("cmd") : new JSONArray();
			int i = ja.length();
			while (i-->0)
			{
				JSONObject jo = ja.getJSONObject(i);
				String lang = jo.has("lang") ? jo.getString("lang") : "java";
				JSONObject JAVA = getData(DB, jo.getString(lang)).getJSONObject("data");
				
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
	
	protected int getDefaultPortNum()
	{
		return 5773;
	}
	
	public Object runtime(String name) { return RUNTIME.get(name); }
	public void runtime(String name, Object val) { RUNTIME.put(name, val); }
	
	public Object global(String name) { return GLOBAL.get(name); }
	public void global(String name, Object val) { GLOBAL.put(name, val); }

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
		src = bm.getData(db, src.getString("cmd")).getJSONObject("data");
		return src.getJSONArray("params");
	}

	public static MetaBot getMetaBot() 
	{
		return (MetaBot)getBot("metabot");
	}
}

