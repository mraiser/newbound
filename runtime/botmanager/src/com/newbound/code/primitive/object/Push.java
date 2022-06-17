package com.newbound.code.primitive.object;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.newbound.code.primitive.Primitive;

public class Push extends Primitive
{
	public Push() throws JSONException {
		super("{ in: { a: {}, b: {} }, out: { a: {} } }");
	}
	
	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			JSONArray a = in.getJSONArray("a");
			Object b = in.get("b");
			Object c = a.put(b);
			out.put("a", c);
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
