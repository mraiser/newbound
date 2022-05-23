package com.newbound.code.primitive.sys;

import com.newbound.code.primitive.Primitive;
import org.json.JSONException;
import org.json.JSONObject;

public class Time  extends Primitive {
    public Time() throws JSONException {
        super("{ in: {}, out: { a: {} } }");
    }

    @Override
    public JSONObject execute(JSONObject query) {
        JSONObject jo = new JSONObject();
        jo.put("a", System.currentTimeMillis());
        return jo;
    }
}
