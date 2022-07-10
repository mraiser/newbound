package com.newbound.code;

import com.newbound.robot.Storage;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;

public class RustEnv implements CodeEnv
{
    private File ROOT = null;
    private Storage STORE = null;

    public RustEnv()
    {
        super();
    }

    public String execute(String lib, String id, String args)
    {
        try {
            JSONObject src = getData(lib, id).getJSONObject("data");
            Code code = new Code(src, lib);
            JSONObject jo = code.execute(new JSONObject(args));
            return jo.toString();
        }
        catch (Exception x)
        {
            x.printStackTrace();
            JSONObject jo = new JSONObject();
            jo.put("status", "err");
            jo.put("msg", x.getMessage());
            return jo.toString();
        }
    }

    public void init(String root)
    {
        ROOT = new File(root);
        STORE = new Storage(ROOT);
        Code.init(this);
    }

    public JSONObject getData(String db, String id) throws Exception
    {
        return STORE.getData(db, id);
    }

    @Override
    public boolean setData(String db, String id, JSONObject data, JSONArray readers, JSONArray writers) throws Exception
    {
        return STORE.setData(db, id, data, readers, writers);
    }

    public File getRootDir()
    {
        return ROOT;
    }
}
