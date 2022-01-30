//return ((com.newbound.robot.MetaBot)BotBase.getBot("metabot")).apps();

BotManager bm = (BotManager)botmanager;
JSONObject apps = new JSONObject();

java.io.File bpf = new java.io.File(bm.getRootDir(), "botd.properties");
java.util.Properties bp = bm.loadProperties(bpf);
JSONArray installed = new JSONArray(bp.getProperty("bots").split(","));
installed.put("com.newbound.robot.BotManager");
apps.put("installed", installed);

JSONArray ja = new JSONArray();

JSONObject identity = null;
try { identity = bm.getData("runtime", "metaidentity").getJSONObject("data"); } catch (Exception x) {
  identity = new JSONObject();
  identity.put("displayname", "Sum Dev");
  identity.put("organization", "");
  identity.put("uuid", bm.getLocalID());
  try { bm.newDB("runtime", null, null); } catch (Exception xx) {}
  bm.setData("runtime", "metaidentity", identity, null, null);
}

java.io.File root = bm.getRootDir().getParentFile();
String[] sa = root.list();
int i = sa.length;
while (i-->0)
{
  String id = sa[i];
  
  java.io.File f = new java.io.File(root, id);
  if (f.isDirectory())
  {
    f = new java.io.File(f, "app.properties");
    if (f.exists()) try
    {
//  System.out.println(id);
      
      java.util.Properties p = bm.loadProperties(f);
      JSONObject jo = new JSONObject();
      jo.put("id", id);
      jo.put("service", id);
      
      JSONArray libs;
      String s = p.getProperty("libraries");
      if (s != null) libs = new JSONArray(s.split(",")); 
      else libs = new JSONArray();
      jo.put("libraries", libs);
      
      s = p.getProperty("ctldb");
      if (s != null)
      {
        JSONObject ctl = new JSONObject();
        ctl.put("db", s);
        ctl.put("id", p.getProperty("ctlid"));
        jo.put("control", ctl);
      }
      
      String name = p.getProperty("name");
      if (name == null) name = id;
      jo.put("name", name);
      
      s = p.getProperty("desc");
      if (s == null) s = "The "+name+" application";
      jo.put("desc", s);
      
      s = p.getProperty("index");
      if (s == null) s = "index.html";
      jo.put("index", s);

      s = p.getProperty("price");
      if (s == null) s = "0";
      jo.put("price", Double.parseDouble(s));

      s = p.getProperty("forsale");
      if (s == null) s = "true";
      jo.put("forsale", Boolean.parseBoolean(s));

      s = p.getProperty("img");
      if (s == null) s = "/metabot/img/icon-square-app-builder.png";
      jo.put("img", s);

      s = p.getProperty("botclass");
      if (s == null) s = "com.newbound.robot.published."+bm.lettersAndNumbersOnly(name);
      jo.put("class", s);
      jo.put("active", id.equals("botmanager") || bp.getProperty("bots").indexOf(s) != -1);

      s = p.getProperty("version");
      if (s == null) s = "0";
      jo.put("version", s);
      
      s = p.getProperty("vendor");
      if (s == null) s = bm.getLocalID();
      jo.put("vendor", s);
      
      s = p.getProperty("vendorversion");
      if (s == null) s = "0";
      jo.put("vendorversion", s);
            
      s = p.getProperty("author");
      if (s == null) 
      {
        s = bm.getLocalID();
        jo.put("authorname", identity.getString("displayname"));
        jo.put("authororg", identity.getString("organization"));
      }
      jo.put("author", s);
      
      s = p.getProperty("authorname");
      if (s != null) jo.put("authorname", s);
      
      s = p.getProperty("authororg");
      if (s != null) jo.put("authororg", s);
      
      s = p.getProperty("hash");
      if (s != null) jo.put("hash", s);
      
      s = p.getProperty("signature");
      if (s != null) jo.put("signature", s);
      
      s = p.getProperty("key");
      if (s != null) jo.put("key", s);
      
      JSONArray gen;
      s = p.getProperty("generate");
      if (s != null) gen = new JSONArray(s.split(",")); 
      else gen = new JSONArray();
      jo.put("generate", gen);
      
      jo.put("published", p.getProperty("key") != null);
      
      ja.put(jo);
    }  
    catch (Exception x) { x.printStackTrace(); }
  }
}

apps.put("list", ja);
return apps;