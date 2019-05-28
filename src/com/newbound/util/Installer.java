package com.newbound.util;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Properties;


public class Installer extends CompilingClassLoader
{
	private Installer(File src) 
	{
		super(src);
	}

	public static void main(String[] args)
	{
		try
		{
			File src = new File("/Users/mraiser/Documents/workspace/Launcher");
			File dst = new File("/Users/mraiser/Desktop/BUILD");
			
			// MIN
//			String[] libs = new String[] {"botmanager", "coreapps", "dashboard", "peerbot", "securitybot", "taskbot"};
//			String[] apps = new String[] {"com.newbound.robot.PeerBot,com.newbound.robot.SecurityBot,com.newbound.robot.AppStore,com.newbound.robot.published.MetaBot"};

			// CYBORGRO
			String[] libs = new String[] {"botmanager", "coreapps", "cyborgro", "dashboard", "emailbot", "filebot", "newboundpowerstrip", "ninjasmoke", "peerbot", "phidgets", "portforwarding", "securitybot", "taskbot"};
			String[] apps = new String[] {"com.newbound.robot.PeerBot,com.newbound.robot.SecurityBot,com.newbound.robot.AppStore,com.newbound.robot.published.PortForwarding,com.newbound.robot.FileBot,com.newbound.robot.published.NinjaSmoke,com.newbound.robot.published.MetaBot,com.newbound.robot.EmailBot,com.newbound.robot.published.PhidgetControl,com.newbound.robot.published.Cyborgro", "com.newbound.robot.published.NewboundPowerstrip"};
			
			build(src, dst, libs, apps, "botmanager", 5773);
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	public static void build(File src, File dst, String[] libs, String[] apps, String defaultapp, int port) throws Exception 
	{
		File py = new File(dst, "main.py");
		copyFile(new File(src, "main.py"), py);
		
		File bat = new File(dst, "NewboundNetwork.bat");
		copyFile(new File(src, "NewboundNetwork.bat"), bat);
		
		File cmd = new File(dst, "Newbound Network.command");
		copyFile(new File(src, "Newbound Network.command"), cmd);
		makeExecutable(cmd);
		
		File sh = new File(dst, "newboundnetwork.sh");
		copyFile(new File(src, "newboundnetwork.sh"), sh);
		makeExecutable(sh);

		new File(dst, "rebuild").createNewFile();

		copyFolder(new File(src, "src"), new File(dst, "src"));
		
		File runtimesrc = new File(src, "runtime");
		
		File brokersrc = new File(runtimesrc, "peerbot");
		brokersrc = new File(brokersrc, "broker.txt");
		copyFile(brokersrc, new File(dst, "broker.txt"));
		
		File libsrc = new File(runtimesrc, "metabot");
		libsrc = new File(libsrc, "libraries");
		
		File libdst = new File(dst, "libraries");
		libdst.mkdirs();
		int i = libs.length;
		while (i-->0)
		{
			String lib = libs[i];
			copyFile(new File(libsrc, lib+".json"), new File(libdst, lib+".json"));
			copyFile(new File(libsrc, lib+".hash"), new File(libdst, lib+".hash"));
			
			File f = findZip(libsrc, lib);
			copyFile(f, new File(libdst, f.getName()));
		}
		
		i = apps.length;
		String bots = "";
		while (i-->0)
		{
			if (!apps[i].endsWith("BotManager"))
			{
				if (!bots.equals("")) bots = ","+bots;
				bots = apps[i]+bots;
			}
		}
		
		Properties bp = new Properties();
		bp.setProperty("bots", bots);
		bp.setProperty("defaultbot", defaultapp);
		bp.setProperty("portnum", ""+port);
		
		FileOutputStream out = new FileOutputStream(new File(dst, "botd.properties"));
		bp.store(out, "");
		out.close();
	}

	private static void makeExecutable(File f) throws Exception
	{
		String[] cmd = {"chmod", "a+x", f.getCanonicalPath()};
		Process proc = Runtime.getRuntime().exec(cmd);
		proc.waitFor();
	}

	private static File findZip(File libsrc, String lib) 
	{
		String[] sa = libsrc.list();
		int i = sa.length;
		while (i-->0) if (sa[i].startsWith(lib+"_")) return new File(libsrc, sa[i]);
		return null;
	}

	public static void install(File dst) throws Exception
	{
		File src = new File(dst, "libraries");
		File runtime = new File(dst, "runtime");
		
		File libraries = new File(runtime, "metabot");
		libraries = new File (libraries, "libraries");
		libraries.mkdirs();
		copyFolder(src, libraries);
		
		File data = new File(dst, "data");
		data.mkdirs();
		
		String[] list = src.list();
		int i = list.length;
		while (i-->0) 
		{
			String lib = list[i];
			if (lib.endsWith(".zip"))
			{
				File f = new File(data, lib.substring(0, lib.lastIndexOf('_')));
				unZip(new File(src, lib), f);
				f = new File(f, "_APPS");
				String[] sa = f.list();
				int j = sa.length;
				while (j-->0)
				{
					File f2 = new File(f, sa[j]);
					if (f2.isDirectory())
					{
						copyFolder(f2, new File(runtime, f2.getName()));
					}
					deleteDir(f);
				}
			}
		}
		
		File f = new File(dst, "broker.txt");
		File f2 = new File(runtime, "peerbot");
		f2 = new File(f2, "broker.txt");
		if (!f2.exists()) f.renameTo(f2);
		else f.delete();
		
		f = new File(dst, "botd.properties");
		f2 = new File(runtime, "botmanager");
		f2 = new File(f2, "botd.properties");
		if (!f2.exists()) f.renameTo(f2);
		else f.delete();
		
		deleteDir(src);
	}
	
}
