package com.newbound.code.primitive.math;

import java.util.Collection;

import org.json.JSONException;
import org.json.JSONObject;

import com.newbound.code.primitive.Primitive;

public class Plus extends Primitive 
{
	public Plus() throws JSONException {
		super("{ in: { a: {}, b: {} }, out: { c: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
//		try
//		{
			Object a = in.get("a");
			Object b = in.get("b");
			Object c = add(a,b);
			if (c == null) throw new RuntimeException("Cannot add types "+a.getClass().getName()+ " and "+b.getClass().getName());
			out.put("c", c);
//		}
//		catch (Exception x) { x.printStackTrace(); }

		return out;
	}

	private Object add(Object a, Object b) 
	{
//		a = toNumber(a);
//		b = toNumber(b);
		if (a instanceof Number && b instanceof Number) return addNumber((Number)a, (Number)b);
		if (a instanceof String || b instanceof String) return ""+a+b;
		
		return null;
	}
	
	private Number addNumber(Number a, Number b) 
	{
		if (a instanceof Double || b instanceof Double) return (a.doubleValue()+b.doubleValue());
		if (a instanceof Float || b instanceof Float) return (a.floatValue()+b.floatValue());
		if (a instanceof Long || b instanceof Long) return (a.longValue()+b.longValue());
		if (a instanceof Integer || b instanceof Integer) return (a.intValue()+b.intValue());
		if (a instanceof Short || b instanceof Short) return (a.shortValue()+b.shortValue());
		if (a instanceof Byte || b instanceof Byte) return (a.byteValue()+b.byteValue());
		
		return null;
	}
}
