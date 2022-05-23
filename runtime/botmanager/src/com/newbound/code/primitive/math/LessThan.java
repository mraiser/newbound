package com.newbound.code.primitive.math;

import com.newbound.code.primitive.Primitive;
import org.json.JSONException;
import org.json.JSONObject;

public class LessThan extends Primitive
{
	public LessThan() throws JSONException {
		super("{ in: { a: {}, b: {} }, out: { a: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		Object ao = in.get("a");
		Object bo = in.get("b");
		if (ao instanceof Number && bo instanceof Number) {
			Number a = toNumber(ao);
			Number b = toNumber(bo);
			out.put("a", lt(a,b));
		}
		else if (ao instanceof String && bo instanceof String) {
			out.put("a", ((String) ao).compareTo(bo.toString())<0);
		}
		else throw new RuntimeException("Incomparable types");

		return out;
	}

	private boolean lt(Number a, Number b)
	{
		if (a instanceof Double || b instanceof Double) return (a.doubleValue()<b.doubleValue());
		if (a instanceof Float || b instanceof Float) return (a.floatValue()<b.floatValue());
		if (a instanceof Long || b instanceof Long) return (a.longValue()<b.longValue());
		if (a instanceof Integer || b instanceof Integer) return (a.intValue()<b.intValue());
		if (a instanceof Short || b instanceof Short) return (a.shortValue()<b.shortValue());
		if (a instanceof Byte || b instanceof Byte) return (a.byteValue()<b.byteValue());
		throw new RuntimeException("Incomparable types");
	}
}
