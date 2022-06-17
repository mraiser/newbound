package com.newbound.code.primitive.sys;

import com.newbound.code.primitive.Primitive;
import org.json.JSONException;
import org.json.JSONObject;

public class Sleep extends Primitive {
    public Sleep() throws JSONException {
        super("{ in: { millis: {} }, out: {} }");
    }

    @Override
    public JSONObject execute(JSONObject query) {
        JSONObject jo = new JSONObject();
        long millis = query.getLong("millis");
        try { Thread.sleep(millis); } catch (Exception x) {}
        return jo;
    }
}
