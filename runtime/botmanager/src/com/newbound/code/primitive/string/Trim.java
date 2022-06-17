package com.newbound.code.primitive.string;

import com.newbound.code.primitive.Primitive;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class Trim extends Primitive
{
	public Trim() throws JSONException {
		super("{ in: { a: {} }, out: { a: {} } }");
	}
	
	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			String a = in.getString("a");
			a = a.trim();
			out.put("a", a);
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
