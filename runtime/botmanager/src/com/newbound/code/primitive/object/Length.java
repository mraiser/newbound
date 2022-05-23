package com.newbound.code.primitive.object;

import com.newbound.code.primitive.Primitive;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class Length extends Primitive
{
	public Length() throws JSONException {
		super("{ in: { a: {} }, out: { a: {} } }");
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
				out.put("a", ((JSONArray)a).length());
			}
			else
			{
				out.put("a", ((String)a).length());
			}
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
