package com.newbound.code.primitive.data;

import com.newbound.code.primitive.Primitive;
import com.newbound.robot.BotManager;
import org.json.JSONException;
import org.json.JSONObject;

public class DataExists extends Primitive
{
	public DataExists() throws JSONException {
		super("{ in: { lib: {}, id: {} }, out: { a: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		String lib = in.getString("lib");
		String id = in.getString("id");
		try {
			boolean b = BotManager.getBot("botmanager").hasData(lib, id);
			out.put("a", b);
		}
		catch (Exception x) { x.printStackTrace(); }
		return out;
	}
}
