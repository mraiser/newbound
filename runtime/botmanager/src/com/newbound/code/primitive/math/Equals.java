package com.newbound.code.primitive.math;

import org.json.JSONException;
import org.json.JSONObject;

import com.newbound.code.primitive.Primitive;

public class Equals extends Primitive 
{
	public Equals() throws JSONException {
		super("{ in: { a: {}, b: {} }, out: { c: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try {
			Object a = in.get("a");
			Object b = in.get("b");
			Boolean c = a.equals(b);
			out.put("c", c);

			System.out.println(a.getClass().getName() + ": " + a);
			System.out.println(b.getClass().getName() + ": " + b);
			System.out.println(c.getClass().getName() + ": " + c);
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
