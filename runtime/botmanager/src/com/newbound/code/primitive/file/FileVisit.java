package com.newbound.code.primitive.file;

import com.newbound.code.primitive.Primitive;
import com.newbound.code.primitive.sys.Execute;
import com.newbound.robot.BotManager;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;

public class FileVisit extends Primitive
{
	public FileVisit() throws JSONException {
		super("{ in: { path: {}, recursive: {}, lib: {}, ctl: {}, cmd: {} }, out: { a: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		String path = in.getString("path");
		boolean recursive = in.getBoolean("recursive");
		String lib = in.getString("lib");
		String ctl = in.getString("ctl");
		String cmd = in.getString("cmd");
		try {
			JSONArray ja = new JSONArray();
			File f = new File(path);
			String[] list = f.list();
			for (int i=0; i<list.length; i++){
				File f2 = new File(f, list[i]);
				JSONObject params = new JSONObject();
				params.put("path", f2.getCanonicalPath());
				JSONObject args = new JSONObject();
				args.put("lib", lib);
				args.put("ctl", ctl);
				args.put("cmd", cmd);
				args.put("params", params);
				JSONObject jo = new Execute().execute(args);
				jo = jo.getJSONObject("a");
				if (jo.has("a")) ja.put(jo.get("a"));

				if (recursive && f2.isDirectory()){
					in.put("path", f2.getCanonicalPath());
					JSONArray ja2 = execute(in).getJSONArray("a");
					for (int j=0;j<ja2.length();j++) ja.put(ja2.get(j));
				}
			}
			out.put("a", ja);
		}
		catch (Exception x) { x.printStackTrace(); }
		return out;
	}
}
