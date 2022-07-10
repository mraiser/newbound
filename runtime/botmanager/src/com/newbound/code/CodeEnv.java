package com.newbound.code;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;

public interface CodeEnv
{
    public JSONObject getData(String db, String id) throws Exception;
    public boolean setData(String db, String id, JSONObject data, JSONArray readers, JSONArray writers) throws Exception;
    public File getRootDir();
}
