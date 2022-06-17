package com.newbound.code.primitive.object;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.newbound.code.primitive.Primitive;

public class Remove extends Primitive 
{
	public Remove() throws JSONException {
		super("{ in: { a: {}, b: {} }, out: { a: {} } }");
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
				int b = in.getInt("b");
				Object c = ((JSONArray)a).remove(b);
				out.put("a", c);
			}
			else
			{
				String b = in.getString("b");
				Object c = ((JSONObject)a).remove(b);
				out.put("a", c);
			}
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
