package com.newbound.code;

import org.json.JSONArray;
import org.json.JSONObject;

public class LibFlow {
    public static native String call(String lib, String ctl, String cmd, String args);
    public static native String list();
    public static native String build(String lib, String ctl, String cmd);
    public static native boolean hasJava();
    public static native boolean hasJavascript();
    public static native boolean hasPython();

    static
    {
        System.loadLibrary("flow");
    }

    public static void init(JSONObject prims) {
        String s = list();
        JSONArray ja = new JSONArray(s);
        int n = ja.length();
        for (int i=0; i<n; i++) {
            JSONObject jo = ja.getJSONObject(i);
            String name = jo.getString("name");
            String io = jo.getString("io");
            prims.put(name, new JSONObject(io));
        }
    }
}
