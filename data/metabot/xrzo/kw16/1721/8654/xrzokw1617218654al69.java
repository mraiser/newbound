//System.out.println("Rebuilding list of libraries...");

JSONObject installed = new JSONObject();
BotBase b = BotBase.getBot("botmanager");
BotBase m = BotBase.getBot("metabot");
JSONArray ja = new JSONArray();
installed.put("list", ja);

File f = new File(b.getRootDir().getParentFile().getParentFile(), "data");
File ff = new File(m.getRootDir(), "libraries");
String[] sa = f.list();
int i;
for (i=0;i<sa.length;i++)
{
  String s = sa[i];
  File f2 = new File(f, s);
  if (f.isDirectory() && !s.startsWith("."))
  {
    try
    {
      if (b.getData(s, "tasklists") != null)
      {
        File f3 = new File(f2, "meta.json");
        JSONObject jo3 = f3.exists() ? new JSONObject(new String(b.readFile(f3))) : new JSONObject();
        File ff2 = new File(ff, s+".json");
        JSONObject jo2 = ff2.exists() ? new JSONObject(new String(b.readFile(ff2))) : new JSONObject();
        jo2.put("id", s);
        jo2.put("name", s);
        if (jo3.has("readers")) jo2.put("readers", jo3.get("readers"));
        if (jo3.has("writers")) jo2.put("writers", jo3.get("writers"));
        jo2.put("encryption", jo3.has("crypt") ? "AES" : "NONE");
        ja.put(jo2);
      }
    }
    catch (Exception x) {}
  }
}
    
//System.out.println("List of libraries rebuilt");

JSONObject result = new JSONObject();
result.put("data", installed);
return result;