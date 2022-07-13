package com.newbound.robot.system;

import java.io.File;
import java.net.InetAddress;
import java.net.URI;
import java.util.Hashtable;

import org.json.JSONArray;
import org.json.JSONObject;

public interface OperatingSystem 
{
	public String osType();
	
	public Class loadClass(File rootDir, String claz, boolean b) throws Exception;
	public InetAddress getLoopbackAddress() throws Exception;

	public void browse(URI uri);
	public String compileClass(File file, String classname);
	public String defaultBots();
	public String defaultBot();
	public JSONObject evalJS(String lib, String ctl, String cmd, String js, JSONObject args);
	public boolean isHeadless();
	public void notification(String subject, String msg, int hashCode);
	public boolean requirePassword();
	public Hashtable<String, File> getCommonFolders();
	public Hashtable<String, File> getSharedFolders();

	// TODO - for backwards compatibility, remove eventually.
	public Hashtable<String, File> getCommonFolders(Object object);
	public Hashtable<String, File> getSharedFolders(Object object);

	public JSONObject evalCommandLine(String app, JSONObject cmd, JSONObject args, File py) throws Exception;
}
