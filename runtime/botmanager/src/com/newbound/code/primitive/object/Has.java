package com.newbound.code.primitive.object;

import com.newbound.code.primitive.Primitive;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class Has extends Primitive
{
	public Has() throws JSONException {
		super("{ in: { a: {}, b: {} }, out: { a: {} } }");
	}
	
	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			JSONObject a = in.getJSONObject("a");
			String b = in.getString("b");
			out.put("a", a.has(b));
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
