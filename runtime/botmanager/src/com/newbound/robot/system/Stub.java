package com.newbound.robot.system;

import java.io.File;
import java.net.InetAddress;
import java.net.URI;
import java.util.Hashtable;

import org.json.JSONObject;

import com.newbound.robot.BotBase;

public class Stub implements OperatingSystem 
{
	private static String DEFAULTBOTS = "com.newbound.robot.PeerBot,com.newbound.robot.SecurityBot,com.newbound.robot.AppStore,com.newbound.robot.published.MetaBot";

	public Class loadClass(File rootDir, String claz, boolean b) throws Exception {
		throw new Exception("System Method loadClass not implemented.");
	}

	public InetAddress getLoopbackAddress() throws Exception {
		throw new Exception("System Method getLoopbackAddress not implemented.");
	}

	public void browse(URI uri) {}

	public void notification(String subject, String msg, int hashCode) {}

	public String compileClass(File file, String classname) { return null; }

	public JSONObject evalJS(String lib, String ctl, String cmd, String js, JSONObject args) { return null; }

	public void restart() {}

	public String defaultBots() 
	{
		return DEFAULTBOTS;
	}

	public String defaultBot() 
	{
		return "botmanager";
	}

	public boolean isHeadless() 
	{
		return true;
	}

	public boolean requirePassword() 
	{
		return true;
	}

	public Hashtable<String, File> getCommonFolders() 
	{
		return new Hashtable<String, File>();
	}

	public Hashtable<String, File> getSharedFolders() 
	{
		return new Hashtable<String, File>();
	}

	public String osType() 
	{
		return "STUB";
	}

	public Hashtable<String, File> getCommonFolders(Object object) {
		// TODO - for backwards compatibility, remove eventually.
		return getCommonFolders();
	}

	public Hashtable<String, File> getSharedFolders(Object object) {
		// TODO - for backwards compatibility, remove eventually.
		return getSharedFolders();
	}

	public Hashtable<String, File> getCommonFolders(BotBase object) {
		// TODO - for backwards compatibility, remove eventually.
		return getCommonFolders();
	}

	public Hashtable<String, File> getSharedFolders(BotBase object) {
		// TODO - for backwards compatibility, remove eventually.
		return getSharedFolders();
	}

	@Override
	public JSONObject evalCommandLine(String app, JSONObject cmd, JSONObject args, File py) throws Exception {
		// TODO Auto-generated method stub
		return null;
	}
}
