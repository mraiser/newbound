package com.newbound.code.primitive.string;

import com.newbound.code.primitive.Primitive;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class Split extends Primitive
{
	public Split() throws JSONException {
		super("{ in: { a: {}, b: {} }, out: { a: {} } }");
	}
	
	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			String a = in.getString("a");
			String b = in.getString("b");
			String[] sa = a.split(b);
			JSONArray ja = new JSONArray(sa);
			out.put("a", ja);
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
