package com.newbound.code.primitive.string;

import com.newbound.code.primitive.Primitive;
import org.json.JSONException;
import org.json.JSONObject;

public class Substring extends Primitive
{
	public Substring() throws JSONException {
		super("{ in: { a: {}, b: {}, c: {} }, out: { a: {} } }");
	}
	
	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			String a = in.getString("a");
			int b = in.getInt("b");
			int c = in.getInt("c");
			out.put("a", a.substring(b, c));
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
