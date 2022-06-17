package com.newbound.code.primitive.data;

import com.newbound.code.primitive.Primitive;
import com.newbound.robot.BotManager;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class LibraryNew extends Primitive
{
	public LibraryNew() throws JSONException {
		super("{ in: { lib: {}, readers: {}, writers: {} }, out: { a: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		String lib = in.getString("lib");
		JSONArray readers = in.getJSONArray("readers");
		JSONArray writers = in.getJSONArray("writers");
		try {
			boolean b = ((BotManager)BotManager.getBot("botmanager")).newDB(lib, readers, writers);
			out.put("a", b);
		}
		catch (Exception x) { x.printStackTrace(); }
		return out;
	}
}
