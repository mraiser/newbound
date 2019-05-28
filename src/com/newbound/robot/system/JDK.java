package com.newbound.robot.system;


import java.awt.Desktop;
import java.awt.GraphicsEnvironment;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.URI;
import java.util.Hashtable;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;

import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.robot.system.OperatingSystem;

public class JDK implements OperatingSystem
{
	private static String DEFAULTBOTS = "com.newbound.robot.PeerBot,com.newbound.robot.SecurityBot,com.newbound.robot.published.MetaBot";

	public boolean isHeadless()
	{
		return GraphicsEnvironment.isHeadless();
	}

	public void browse(URI uri)
	{
		try
		{
			Desktop.getDesktop().browse(uri);
		}
		catch (Exception x) {x.printStackTrace(); }
	}

	public String defaultBots() 
	{
		return DEFAULTBOTS;
	}

	public String defaultBot() 
	{
		return "botmanager";
	}

	public InetAddress getLoopbackAddress() 
	{
		return InetAddress.getLoopbackAddress();
	}

	public Hashtable<String, File> getSharedFolders() 
	{
		Hashtable<String,File> v = new Hashtable();
//		v.put("files", new File(b.getRootDir(), "files"));
		
		return v;
	}

	public Hashtable<String, File> getCommonFolders() 
	{
		Hashtable<String,File> v = new Hashtable();
//		v.put("files", new File(b.getRootDir(), "files"));
		v.put("filesystem", new File("/"));
		
		File f = new File(System.getProperty("user.home"));
		File f2 = new File(f, "Desktop"); if (f2.exists()) v.put("Desktop", f2);
		f2 = new File(f, "Documents"); if (f2.exists()) v.put("Documents", f2);
		f2 = new File(f, "Downloads"); if (f2.exists()) v.put("Downloads", f2);
		f2 = new File(f, "Movies"); if (f2.exists()) v.put("Movies", f2);
		f2 = new File(f, "Music"); if (f2.exists()) v.put("Music", f2);
		f2 = new File(f, "Pictures"); if (f2.exists()) v.put("Pictures", f2);
		
		return v;
	}

	public boolean requirePassword() 
	{
		return true;
	}

	public Class loadClass(File rootdir, String name, boolean resolve) throws ClassNotFoundException 
	{
/*		
		Vector<File> v = new Vector();
		v.addElement(rootdir);
		
		File top = BotBase.getBot("botmanager").getRootDir().getParentFile().getParentFile();
		File bin = new File(top, "bin");

		Vector<File> jars = new Vector();
		File lib = new File(top, "lib");
		lib.mkdirs();
		String[] libs = lib.list();
		int j = libs.length;
		while (j-->0) jars.addElement(new File(lib, libs[j]));
		
		CompilingClassLoader cc = new CompilingClassLoader(getClass().getClassLoader(), v, bin, jars);
		return cc.loadClass(name);
*/
		return getClass().getClassLoader().loadClass(name);
	}

	public String compileClass(File rootdir, String name)
	{
		// FIXME - Ignoring rootdir!
		try { Class.forName(name); } catch (ClassNotFoundException x) { return x.getMessage(); }
		return "";
	}
	
	public void notification(String title, String text, int code)
	{
		
	}

	public JSONObject evalJS(String js) 
	{
		JSONObject jo = new JSONObject();
		
		ScriptEngineManager factory = new ScriptEngineManager();
	    ScriptEngine engine = factory.getEngineByName("JavaScript");
	    try 
	    { 
	    	jo.put("data", engine.eval("function doathing() { "+js+" } doathing();")); 
	    	jo.put("status", "ok");
	    }
	    catch (Exception x) 
	    { 
	    	x.printStackTrace(); 
	    	jo.put("status", "err");
	    	jo.put("msg", x.getMessage());
	    }
	    return jo;
	}

	public String osType() 
	{
		return "JDK";
	}

	public Hashtable<String, File> getCommonFolders(Object object) {
		// TODO - for backwards compatibility, remove eventually.
		return getCommonFolders();
	}

	public Hashtable<String, File> getSharedFolders(Object object) {
		// TODO - for backwards compatibility, remove eventually.
		return getSharedFolders();
	}

	@Override
	public JSONObject evalCommandLine(String app, JSONObject cmd, JSONObject args, File py) throws Exception 
	{
		JSONArray params = cmd.getJSONArray("params");
		int i = params.length();
		String[] call = new String[i+2];
		call[0] = app;
		call[1] = py.getCanonicalPath();
		while (i-->0) 
		{
			String s = params.getJSONObject(i).getString("name");
			s = ""+args.get(s);
			call[i+2] = s;
		}
		
		Process p = Runtime.getRuntime().exec(call);
		p.waitFor();
		i = p.exitValue();
		
		if (i == 0)
		{
			ByteArrayOutputStream baos = new ByteArrayOutputStream();
			sendData(p.getInputStream(), baos, -1, 4096);
			sendData(p.getErrorStream(), System.out, -1, 4096);
			baos.close();
			
			String s = baos.toString();
			return new JSONObject(s);
		}
		else
		{
			ByteArrayOutputStream baos = new ByteArrayOutputStream();
			sendData(p.getErrorStream(), baos, -1, 4096);
			baos.close();
			String s = baos.toString();
			
			JSONObject jo = new JSONObject();
			jo.put("status",  "err");
			jo.put("msg",  s);
			
			return jo;
		}
	}

    public static long sendData(InputStream dataIS, OutputStream dataOS, int length, int chunkSize) throws Exception 
    {
    	OutputStream[] osa = { dataOS };
    	return sendData(dataIS, osa, length, chunkSize);
    }

    public static long sendData(InputStream dataIS, OutputStream[] osa, int length, int chunkSize) throws Exception 
    {
    	long numbytes = 0;
    	if (length != -1) chunkSize = Math.min(length, chunkSize);
    	
		// Send the data in chunks of mFileChunkSize bytes
		byte[] fileBuf = new byte[chunkSize];
		int i = 0;
	
		// As long as there's data available without blocking, send it
		// Then test to see if we're blocking by reading one character.
		// Repeat until there's no more data to send.
		int oneChar;
		while (length == -1 || numbytes < length)
		{
            i=dataIS.available();
		
            if (i > 1) 
            {
                if (i>chunkSize) i = chunkSize;
                if (length != -1 && numbytes+i>length) i = (int)(length - numbytes);
                int num = dataIS.read(fileBuf,0,i);
                int j = osa.length;
                while (j-->0) osa[j].write(fileBuf, 0, num);
                numbytes += num;
            }
		
            if (length == -1 || numbytes < length) 
            {
            	oneChar = dataIS.read();
                if (oneChar == -1) 
                	break;
                int j = osa.length;
                while (j-->0) osa[j].write(oneChar);
                numbytes++;
            }
		
		}
		
        int j = osa.length;
        while (j-->0) osa[j].flush();
		
		return numbytes;
    }

	public static void copyFile(File f, File f2) throws Exception
	{
		copyFile(f,f2,true);
	}
	
	public static void copyFile(File f, File f2, boolean replace) throws Exception
	{
		if (replace || !f2.exists())
		{
			InputStream is = new FileInputStream(f);
			OutputStream os = new FileOutputStream(f2);
			sendData(is, os, (int)f.length(), 4096);
			os.flush();
			os.close();
			is.close();
		}
	}
}
