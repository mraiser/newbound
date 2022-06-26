package com.newbound.code.primitive.string;

import com.newbound.code.primitive.Primitive;
import org.json.JSONException;
import org.json.JSONObject;

public class EndsWith extends Primitive
{
	public EndsWith() throws JSONException {
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
			out.put("a", a.endsWith(b));
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
