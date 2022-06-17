package com.newbound.code.primitive.object;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.newbound.code.primitive.Primitive;

public class Set extends Primitive
{
	public Set() throws JSONException {
		super("{ in: { object: {}, key: {}, value: {} }, out: { a: {} } }");
	}
	
	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			Object a = in.get("object");
			if (a instanceof JSONArray)
			{
				int b = in.getInt("key");
				Object c = in.get("value");
				Object d = ((JSONArray)a).put(b,c);
				out.put("a", d);
			}
			else
			{
				String b = in.getString("key");
				Object c = in.get("value");
				Object d = ((JSONObject)a).put(b, c);
				out.put("a", d);
			}
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
