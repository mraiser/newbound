package com.newbound.robot;

import com.newbound.crypto.SuperSimpleCipher;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.Hashtable;

public class Storage extends BotUtil
{
    private File ROOT;
    protected Hashtable<String,SuperSimpleCipher[]> KEYS = new Hashtable();

    public Storage(File f)
    {
        ROOT = f;
    }

    public File getDB(String id)
    {
//	  File f = new File(getRootDir(), "data");
        File f = new File(getRootDir().getParentFile().getParentFile(), "data");
        f = new File(f, id);
        return f;
    }

    private File getRootDir() {
        return ROOT;
    }

    protected SuperSimpleCipher[] getKeys(String db) throws Exception
    {
        SuperSimpleCipher[] ssca = KEYS.get(db);

        if (ssca == null)
        {
            File f = new File(getDB(db), "meta.json");
            byte[] ba = readFile(f);
            JSONObject jo = new JSONObject(new String(ba));
            if (jo.has("crypt"))
            {
                byte[] writekey = fromHexString(jo.getString("crypt"));

                SuperSimpleCipher sscw = new SuperSimpleCipher(writekey, true);
                SuperSimpleCipher sscr = new SuperSimpleCipher(writekey, false);
                ssca = new SuperSimpleCipher[2];
                ssca[0] = sscr;
                ssca[1] = sscw;
            }
            else ssca = new SuperSimpleCipher[0];

            KEYS.put(db, ssca);
        }

        return ssca;
    }

    public JSONObject getData(String db, String id) throws Exception
    {
        SuperSimpleCipher[] keys = getKeys(db);
        boolean plaintext = keys.length == 0;
        File f = getDataFile(db, id, keys);

        if (!f.exists())
            throw new Exception("No such record "+db+"/"+id);

        byte[] ba = readFile(f);
        JSONObject jo = new JSONObject(new String(plaintext ? ba : keys[0].decrypt(ba)));

        JSONObject d = jo.getJSONObject("data");
        if (plaintext && d.has("attachmentkeynames")) // FIXME - HACK
            loadAttachments(f.getParentFile(), d, id);

        return jo;
    }

    protected File getDataFile(String db, String id, SuperSimpleCipher[] keys) throws Exception
    {
        File f = getDB(db);
        try {
            String name = keys.length == 0 ? id : toHexString(keys[1].encrypt(id.getBytes()));
            f = getSubDir(f, name, 4, 4);
            f = new File(f, name);
        }catch(Exception x) {
            System.out.println(x);
        }
        return f;
    }

    // FIXME - Doesn't work with encrypted libraries
    private void loadAttachments(File root, JSONObject d, String name) throws Exception
    {
        JSONArray ja = d.getJSONArray("attachmentkeynames");
        int i = ja.length();
        while (i-- > 0)
        {
            String key = ja.getString(i);
            File f = new File(root, name + "." + key);
            String s = new String(BotUtil.readFile(f));
            String ss = s.trim();
            if (ss.startsWith("{") && ss.endsWith("}")) // FIXME - HACK
                d.put(key, new JSONObject(ss));
            else
                d.put(key, s);
        }
    }
}
