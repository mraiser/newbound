package com.newbound.code.primitive.object;

import com.newbound.code.primitive.Primitive;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class IndexOf extends Primitive
{
	public IndexOf() throws JSONException {
		super("{ in: { a: {}, b: {} }, out: { a: {} } }");
	}
	
	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		try
		{
			JSONArray a = in.getJSONArray("a");
			Object b = in.get("b");
			int n = a.length();
			for (int i=0;i<n;i++) {
				if (a.get(i).equals(b)) {
					out.put("a", i);
					break;
				}
			}
		}
		catch (Exception x) { x.printStackTrace(); }

		return out;
	}
}
