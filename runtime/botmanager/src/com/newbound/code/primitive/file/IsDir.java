package com.newbound.code.primitive.file;

import com.newbound.code.primitive.Primitive;
import com.newbound.code.primitive.sys.Execute;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;

public class IsDir extends Primitive
{
	public IsDir() throws JSONException {
		super("{ in: { path: {} }, out: { a: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		String path = in.getString("path");
		File f = new File(path);
		boolean a = f.isDirectory();
		out.put("a", a);
		return out;
	}
}
