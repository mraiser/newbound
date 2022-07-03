package com.newbound.net.service.http;

import com.newbound.robot.BotUtil;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.*;

public class CORS
{
    private Vector<String> PATHS = null;
    private Hashtable<String, Vector<String>> MAP = null;
    private File JSON = null;
    private long LASTMODIFIED = -1;

    public CORS(File root) throws Exception
    {
        JSON = new File(root, "cors.json");
        load();
    }

    private void load() throws Exception
    {
        PATHS = new Vector();
        MAP = new Hashtable();

        if (JSON.exists()) {
            byte[] ba = BotUtil.readFile(JSON);
            JSONObject jo = new JSONObject(new String(ba));
            Iterator<String> i = jo.keys();
            while (i.hasNext()) {
                String key = i.next();
                PATHS.addElement(key);
                Vector<String> v = new Vector();
                JSONArray ja = jo.getJSONArray(key);
                for (int j = 0; j < ja.length(); j++) v.addElement(ja.getString(j));
                MAP.put(key, v);
            }
            Collections.sort(PATHS, new Comparator<String>() {
                @Override
                public int compare(String s, String t1) {
                    return s.length() - t1.length();
                }
            });

            LASTMODIFIED = JSON.lastModified();
        }
    }

    public String lookup(String path, String origin) throws Exception
    {
        if (JSON.exists() && LASTMODIFIED < JSON.lastModified()) load();

        path = "/"+path;
        int i = PATHS.size();
        while (i-->0)
        {
            String s = PATHS.elementAt(i);
            if (path.startsWith(PATHS.elementAt(i)))
            {
                Vector<String> v = MAP.get(s);
                int j = v.indexOf(origin);
                if (j == -1) j = v.indexOf("*");
                if (j != -1)
                    return v.elementAt(j);
            }
        }
        return null;
    }
}
