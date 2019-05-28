package com.newbound.code.primitive.object;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.newbound.code.primitive.Primitive;

public class Put extends Primitive 
{
	public Put() throws JSONException {
		super("{ in: { a: {}, b: {}, c: {} }, out: { d: {} } }");
	}
	
	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			Object a = in.get("a");
			if (a instanceof JSONArray)
			{
				Object b = in.get("b");
				int c = in.getInt("c");
				Object d = ((JSONArray)a).put(c, b);
				out.put("d", d);
			}
			else
			{
				String b = in.getString("b");
				Object c = in.get("c");
				Object d = ((JSONObject)a).put(b, c);
				out.put("d", d);
			}
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
