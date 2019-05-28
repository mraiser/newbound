package com.newbound.code.primitive.math;

import org.json.JSONException;
import org.json.JSONObject;

import com.newbound.code.primitive.Primitive;

public class Multiply extends Primitive 
{
	public Multiply() throws JSONException {
		super("{ in: { a: {}, b: {} }, out: { c: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			Number a = toNumber(in.get("a"));
			Number b = toNumber(in.get("b"));
			Object c = multiply(a,b);
			if (c == null) throw new RuntimeException("Cannot multiply types "+a.getClass().getName()+ " and "+b.getClass().getName());
			out.put("c", c);
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}

	private Object multiply(Number a, Number b) 
	{
		if (a instanceof Double || b instanceof Double) return (a.doubleValue()*b.doubleValue());
		if (a instanceof Float || b instanceof Float) return (a.floatValue()*b.floatValue());
		if (a instanceof Long || b instanceof Long) return (a.longValue()*b.longValue());
		if (a instanceof Integer || b instanceof Integer) return (a.intValue()*b.intValue());
		if (a instanceof Short || b instanceof Short) return (a.shortValue()*b.shortValue());
		if (a instanceof Byte || b instanceof Byte) return (a.byteValue()*b.byteValue());

		return null;
	}
}
