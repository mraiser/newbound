package com.newbound.code.primitive.sys;

import com.newbound.code.primitive.Primitive;
import com.newbound.robot.BotBase;
import org.json.JSONException;
import org.json.JSONObject;

public class UniqueSessionID extends Primitive {
    public UniqueSessionID() throws JSONException {
        super("{ in: {}, out: { a: {} } }");
    }

    @Override
    public JSONObject execute(JSONObject query) {
        JSONObject jo = new JSONObject();
        jo.put("a", BotBase.uniqueSessionID());
        return jo;
    }
}
