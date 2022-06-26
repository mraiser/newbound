package com.newbound.code.primitive;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class NativePrimitive extends Primitive
{
    private String name;

    public NativePrimitive(String name, String params) throws JSONException
    {
        super(params);
        this.name = name;
    }

    public static void init(JSONObject prims) {
        String s = NativePrimitiveCall.list();
        JSONArray ja = new JSONArray(s);
        int n = ja.length();
        for (int i=0; i<n; i++) {
            JSONObject jo = ja.getJSONObject(i);
            String name = jo.getString("name");
            String io = jo.getString("io");
            prims.put(name, new NativePrimitive(name, io));
        }
    }

    @Override
    public JSONObject execute(JSONObject query)
    {
        String args = query.toString();
        String result = NativePrimitiveCall.call(name, args);
        try {
            return new JSONObject(result);
        }
        catch(JSONException x) { throw new RuntimeException(result); }
    }
}
