File f = new File(botmanager.getRootDir().getParentFile().getParentFile(), "data");
f = new File(f, lib);
f = new File(f, "_ASSETS");
f.mkdirs();
String[] list = f.list(new NoDotFilter());
JSONArray ja = new JSONArray();
for (int i=0; i<list.length; i++)
{
  JSONObject jo = new JSONObject();
  jo.put("name", list[i]);
  jo.put("id", list[i]);
  ja.put(jo);
}
JSONObject jo = new JSONObject();
jo.put("list", ja);

JSONObject jo2 = new JSONObject();
try { jo2 = botmanager.getData(lib, "assets").getJSONObject("data"); } catch (Exception x) {}

if (!jo2.toString().equals(jo.toString())) 
  botmanager.setData(lib, "assets", jo, null, null);

return "OK";