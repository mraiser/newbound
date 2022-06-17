package com.newbound.code.primitive.sys;

import com.newbound.code.primitive.Primitive;
import org.json.JSONException;
import org.json.JSONObject;

public class StdOut extends Primitive {
    public StdOut() throws JSONException {
        super("{ in: { a: {} }, out: {} }");
    }

    @Override
    public JSONObject execute(JSONObject query) {
        JSONObject jo = new JSONObject();
        Object a = query.get("a");
        System.out.println(a);
        return jo;
    }
}
