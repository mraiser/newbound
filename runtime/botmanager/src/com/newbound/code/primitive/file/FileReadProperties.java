package com.newbound.code.primitive.file;

import com.newbound.code.primitive.Primitive;
import com.newbound.robot.BotManager;
import com.newbound.robot.BotUtil;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.util.Properties;

public class FileReadProperties extends Primitive
{
	public FileReadProperties() throws JSONException {
		super("{ in: { path: {} }, out: { a: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		String path = in.getString("path");
		try {
			File f = ((BotManager)BotManager.getBot("botmanager")).getRootDir().getParentFile().getParentFile();
			f = new File(f, path);
			Properties p = BotUtil.loadProperties(f);
			JSONObject b = new JSONObject(p);
			out.put("a", b);
		}
		catch (Exception x) { x.printStackTrace(); }
		return out;
	}
}
