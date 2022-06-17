package com.newbound.code.primitive.data;

import com.newbound.code.primitive.Primitive;
import com.newbound.robot.BotManager;
import org.json.JSONException;
import org.json.JSONObject;

public class LibraryExists extends Primitive
{
	public LibraryExists() throws JSONException {
		super("{ in: { lib: {} }, out: { a: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		String lib = in.getString("lib");
		try {
			boolean b = ((BotManager)BotManager.getBot("botmanager")).getDB(lib).exists();
			out.put("a", b);
		}
		catch (Exception x) { x.printStackTrace(); }
		return out;
	}
}
