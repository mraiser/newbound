package com.newbound.code.primitive.file;

import com.newbound.code.primitive.Primitive;
import com.newbound.robot.BotManager;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;

public class FileExists extends Primitive
{
	public FileExists() throws JSONException {
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
			boolean b = f.exists();
			out.put("a", b);
		}
		catch (Exception x) { x.printStackTrace(); }
		return out;
	}
}
