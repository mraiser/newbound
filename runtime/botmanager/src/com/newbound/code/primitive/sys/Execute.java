package com.newbound.code.primitive.sys;

import com.newbound.code.Code;
import com.newbound.code.primitive.Primitive;
import com.newbound.robot.BotBase;
import com.newbound.robot.MetaBot;
import org.json.JSONException;
import org.json.JSONObject;

public class Execute extends Primitive {
    public Execute() throws JSONException {
        super("{ in: { lib: {}, ctl: {}, cmd: {}, params: {}}, out: { a: {} } }");
    }

    @Override
    public JSONObject execute(JSONObject jo) {
        String lib = jo.getString("lib");
        String ctl = jo.getString("ctl");
        String cmd = jo.getString("cmd");
        JSONObject params = jo.getJSONObject("params");
        try {
            MetaBot mb = (MetaBot) BotBase.getBot("metabot");
            String id = mb.lookupCmdID(lib, ctl, cmd);
            JSONObject src = mb.getData(lib, id).getJSONObject("data");
            Code code = new Code(src, lib);
            JSONObject jo2 = code.execute(params);
            JSONObject jo3 = new JSONObject();
            jo3.put("a", jo2);
            return jo3;
        }
        catch (Exception x) { x.printStackTrace(); }

        return null;
    }
}
