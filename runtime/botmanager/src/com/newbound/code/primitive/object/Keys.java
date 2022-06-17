package com.newbound.code.primitive.object;

import com.newbound.code.primitive.Primitive;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

public class Keys extends Primitive
{
	public Keys() throws JSONException {
		super("{ in: { a: {} }, out: { a: {} } }");
	}
	
	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			JSONObject a = in.getJSONObject("a");
			JSONArray ja = new JSONArray();
			Iterator<String> i = a.keys();
			while (i.hasNext()) ja.put(i.next());
			out.put("a", ja);
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
