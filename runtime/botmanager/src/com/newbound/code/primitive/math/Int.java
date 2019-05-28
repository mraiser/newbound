package com.newbound.code.primitive.math;

import org.json.JSONException;
import org.json.JSONObject;

import com.newbound.code.primitive.Primitive;

public class Int extends Primitive 
{
	public Int() throws JSONException {
		super("{ in: { a: {} }, out: { b: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try {
			String a = "" + in.get("a");
			int i = a.indexOf('.');
			if (i != -1) a = a.substring(0, i);
			out.put("b", Integer.parseInt(a));
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
