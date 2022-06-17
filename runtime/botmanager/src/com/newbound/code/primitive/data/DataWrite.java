package com.newbound.code.primitive.data;

import com.newbound.code.primitive.Primitive;
import com.newbound.robot.BotManager;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class DataWrite extends Primitive
{
	public DataWrite() throws JSONException {
		super("{ in: { lib: {}, id: {}, data: {}, readers: {}, writers: {} }, out: {} }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		String lib = in.getString("lib");
		String id = in.getString("id");
		JSONObject data = in.getJSONObject("data");
		JSONArray readers = in.getJSONArray("readers");
		JSONArray writers = in.getJSONArray("writers");
		try {
			BotManager.getBot("botmanager").setData(lib, id, data, readers, writers);
			out.put("a", 1);
		}
		catch (Exception x) { x.printStackTrace(); }
		return out;
	}
}
