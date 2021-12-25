java.io.File f = new java.io.File(botmanager.getRootDir(), "botd.properties");
java.util.Properties p = botmanager.loadProperties(f);
JSONArray ja = new JSONArray(p.getProperty("bots").split(","));
int i = ja.length();
String bots = null;
while (i-->0)
{
  String claz = ja.getString(i);
  if (!classname.equals(claz))
  {
    if (bots == null) bots = claz;
    else bots = claz+","+bots;
  }
}
p.setProperty("bots", bots);
botmanager.storeProperties(p, f);

return new JSONObject();