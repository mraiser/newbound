package com.newbound.util;

import java.io.File;
import java.io.FileOutputStream;

import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.robot.BotBase;

public class Publisher
{
	public static JSONObject publish(JSONObject data) throws Exception 
	{
		BotBase metabot = BotBase.getBot("metabot");
		File src = metabot.getRootDir().getParentFile().getParentFile(); 
		File dst = metabot.newTempFile();
		dst.mkdirs();

		JSONArray libja = data.getJSONArray("libs");
		int n = libja.length();
		String[] libs = new String[n];
		while (n-->0) libs[n] = libja.getString(n);

		JSONArray appja = data.getJSONArray("apps");
		n = appja.length();
		String[] apps = new String[n];
		while (n-->0) apps[n] = appja.getString(n);

		String d = data.getString("default");
		int port = data.getInt("port");
		Installer.build(src, dst, libs, apps, d, port);

		d = data.getString("name");

		File f = new File(metabot.getRootDir(), "html");
		f.mkdirs();
		File zip = new File(f, d+".zip");
		FileOutputStream fos = new FileOutputStream(zip);
		metabot.zipDir(dst, fos);
		fos.close();

		JSONObject jo2 = new JSONObject();
		jo2.put("jar", "../metabot/"+d+".zip");

		metabot.deleteDir(dst);

		return jo2;
	}
	
}
