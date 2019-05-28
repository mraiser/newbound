package com.newbound.net.service.http;
import java.io.File;
import java.net.URL;
import java.util.Hashtable;

import org.json.JSONObject;

import com.newbound.net.service.App;
import com.newbound.net.service.Container;
import com.newbound.robot.Session;

public class SimpleHTTPServer implements Container 
{
	File ROOT;
	String PREFIX;

	public SimpleHTTPServer(File root, String prefix) 
	{
		ROOT = root;
		PREFIX = prefix;
	}

	public static void main(String[] args) throws Exception 
	{
		HTTPService http = new HTTPService(new SimpleHTTPServer(getRootDir(), "html/"), 8080);
	}


	private static File getRootDir() 
	{
		File SRC = null;
		String os = System.getProperty("os.name");
		if (os.equals("Mac OS X"))
		{
			String p = null;
			try { p = new File("x").getCanonicalFile().getParentFile().getParentFile().getParentFile().getName(); }
			catch (Exception x) { p = "DEFAULT"; }
			if (p.endsWith(".app")) p = p.substring(0, p.lastIndexOf('.'));

			File f = new File(System.getProperty("user.home"));
			f = new File(f, "Library"); 
			f = new File(f, "Application Support"); 
			f = new File(f, "Newbound"); 
			f = new File(f, p); 
			f = new File(f, "src");
			SRC = f;
		}
		else if (os.startsWith("Windows"))
		{
			String ad = System.getenv("LOCALAPPDATA");
			if (ad != null)
			{
				String p = null;
				try { p = new File("x").getCanonicalFile().getParentFile().getParentFile().getName(); }
				catch (Exception x) { p = "DEFAULT"; }
				if (p.endsWith(".app")) p = p.substring(0, p.lastIndexOf('.'));

				File f = new File(ad);
				f = new File(f, "Newbound"); 
				f = new File(f, p); 
				f = new File(f, "src");
				SRC = f;
			}
		}
		
		if (SRC == null)
		{
			String p = null;
			try { p = new File("x").getCanonicalFile().getParentFile().getName(); }
			catch (Exception x) { p = "DEFAULT"; }
			if (p.endsWith(".app")) p = p.substring(0, p.lastIndexOf('.'));

			File f = new File(System.getProperty("user.home"));
			f = new File(f, "Newbound");
			f = new File(f, p); 
			SRC = new File(f, "src");
		}

		return SRC.getParentFile();
	}


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
			URL u = getClass().getClassLoader().getResource(PREFIX+cmd);
			return u;
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
		try
		{
			path = new File(ROOT, path).getCanonicalPath();
			File f = new File(path);
			return f;
		}
		catch (Exception x) { x.printStackTrace(); }
		return null;
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

}
