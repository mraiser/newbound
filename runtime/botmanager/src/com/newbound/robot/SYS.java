package com.newbound.robot;

import java.io.File;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Hashtable;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import com.newbound.robot.system.OperatingSystem;
import com.newbound.robot.system.Stub;


public class SYS
{
	public static boolean RUNNING = false;

	private static OperatingSystem sys = null;

	static
	{
		String pkg = "com.newbound.robot.system.";
		
		try { sys = (OperatingSystem)Class.forName(pkg+"JDK").newInstance(); System.out.println("!!!!!!!!!! OS = JDK !!!!!!!!!!"); }
		catch (Exception i1)
		{
			try { sys = (OperatingSystem)Class.forName(pkg+"IOS").newInstance(); System.out.println("!!!!!!!!!! OS = IOS !!!!!!!!!!"); }
			catch (Exception i2)
			{
				try { sys = (OperatingSystem)Class.forName(pkg+"Android").newInstance(); System.out.println("!!!!!!!!!! OS = ANDROID !!!!!!!!!!"); }
				catch (Exception i3)
				{
					System.out.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
					System.out.println("No OS implementation, using STUB");
					System.out.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
					sys = new Stub();
				}
			}
		}
	}
	
	public static String osType() { return sys.osType(); }

	public static void browse(URI uri) { sys.browse(uri); }
	public static String compileClass(File file, String classname) { return sys.compileClass(file, classname); }
	public static String defaultBots() { return sys.defaultBots(); }
	public static String defaultBot() { return sys.defaultBot(); }
	public static JSONObject evalJS(String js) { return sys.evalJS(js); }
	public static boolean isHeadless() { return sys.isHeadless(); }
	public static void notification(String subject, String msg, int hashCode) { sys.notification(subject, msg, hashCode); }
	public static boolean requirePassword() { return sys.requirePassword(); }
	public static Hashtable<String, File> getCommonFolders() { return sys.getCommonFolders(null); }
	public static Hashtable<String, File> getSharedFolders() { return sys.getSharedFolders(null); }

	public static Class loadClass(File rootDir, String claz, boolean b) throws Exception { return sys.loadClass(rootDir, claz, false); }
	public static InetAddress getLoopbackAddress() throws Exception { return sys.getLoopbackAddress(); }

	public static JSONObject evalCommandLine(String app, JSONObject cmd, JSONObject args, File py) throws Exception { return sys.evalCommandLine(app, cmd, args, py); }
}
