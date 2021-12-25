String appid = data.getString("id");
java.io.File f = new java.io.File(botmanager.getRootDir().getParentFile(), appid);
f.mkdirs();
f = new java.io.File(f, "app.properties");
java.util.Properties p = f.exists() ? botmanager.loadProperties(f) : new java.util.Properties();

java.util.Iterator i = data.keys();
while (i.hasNext())
{
  String key = (String)i.next();
  String val = data.getString(key);
  p.setProperty(key, val);
}

botmanager.storeProperties(p, f);

return new JSONObject(p);