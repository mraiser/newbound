package com.newbound.code;

import org.json.JSONObject;
import java.io.File;

public interface CodeEnv
{
    public JSONObject getData(String db, String id) throws Exception;
    public File getRootDir();
}
