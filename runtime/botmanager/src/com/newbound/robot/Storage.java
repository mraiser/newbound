package com.newbound.robot;

import com.newbound.crypto.SuperSimpleCipher;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
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

    public boolean setData(String db, String id, JSONObject data, JSONArray readers, JSONArray writers) throws Exception
    {
        File root = getDB(db);
        SuperSimpleCipher[] keys = getKeys(db);
        boolean plaintext = keys.length == 0;
        String name = plaintext ? id : toHexString(keys[1].encrypt(id.getBytes()));
        root = getSubDir(root, name, 4, 4);
        root.mkdirs();
        File f = new File(root, name);

        if (plaintext && data.has("attachmentkeynames")) // FIXME - HACK
            saveAttachments(root, data, name);

        JSONObject jo = new JSONObject();
        jo.put("id", id);
        jo.put("data", data);
        jo.put("username", "system");
        jo.put("time", System.currentTimeMillis());
        if (readers != null) jo.put("readers", readers);
        if (writers != null) jo.put("writers", writers);

        writeFile(f, plaintext ? jo.toString().getBytes() : keys[1].encrypt(jo.toString().getBytes()));
        return true;
    }

    public void deleteData(String db, String id) throws Exception
    {
        File f = getDB(db);
        SuperSimpleCipher[] keys = getKeys(db);
        boolean plaintext = keys.length == 0;
        String name = plaintext ? id : toHexString(keys[1].encrypt(id.getBytes()));
        f = getSubDir(f, name, 4, 4);
        f = new File(f, name);

        if (!f.exists()) throw new Exception("No such record");

        if (plaintext) try
        {
            byte[] ba = readFile(f);
            JSONObject jo = new JSONObject(new String(plaintext ? ba : keys[0].decrypt(ba))); // FIXME - plaintext always true
            JSONObject d = jo.getJSONObject("data");
            if (d.has("attachmentkeynames")) // FIXME - HACK
                deleteAttachments(f.getParentFile(), d, id);
        }
        catch (Exception x) { x.printStackTrace(); }

        f.delete();
    }

    // FIXME - Doesn't work with encrypted libraries
    protected void saveAttachments(File root, JSONObject d, String name) throws IOException
    {
        JSONArray ja = d.getJSONArray("attachmentkeynames");
        int i = ja.length();
        while (i-->0)
        {
            String key = ja.getString(i);
            File f = new File(root, name + "." + key);
            writeFile(f, d.remove(key).toString().getBytes());
        }
    }

    // FIXME - Doesn't work with encrypted libraries
    protected void deleteAttachments(File root, JSONObject d, String name) throws Exception
    {
        JSONArray ja = d.getJSONArray("attachmentkeynames"); // FIXME - HACK
        int i = ja.length();
        while (i-- > 0)
        {
            String key = ja.getString(i);
            File f = new File(root, name + "." + key);
            f.delete();
        }
    }
}
