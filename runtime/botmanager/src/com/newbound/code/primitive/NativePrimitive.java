package com.newbound.code.primitive;

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
