package com.newbound.code.primitive.object;

import com.newbound.code.primitive.Primitive;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class ToJSON extends Primitive
{
	public ToJSON() throws JSONException {
		super("{ in: { a: {} }, out: { a: {} } }");
	}
	
	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			JSONObject a = in.getJSONObject("a");
			out.put("a", a.toString());
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
