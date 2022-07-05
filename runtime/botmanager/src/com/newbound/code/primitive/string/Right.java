package com.newbound.code.primitive.string;

import com.newbound.code.primitive.Primitive;
import org.json.JSONException;
import org.json.JSONObject;

public class Right extends Primitive
{
	public Right() throws JSONException {
		super("{ in: { a: {}, b: {} }, out: { a: {} } }");
	}
	
	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			String a = in.getString("a");
			int b = in.getInt("b");
			b = a.length() - b;
			out.put("a", a.substring(0, b));
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
