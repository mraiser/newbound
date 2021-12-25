String appid = data.getString("name");
java.io.File f = new java.io.File(botmanager.getRootDir().getParentFile(), appid);
f = new java.io.File(f, "app.properties");
java.util.Properties p;
if (f.exists()) p = botmanager.loadProperties(f);
else
{
  String name = appid.substring(0,1).toUpperCase()+appid.substring(1);
  p = new java.util.Properties();
  p.put("name", name);
  p.put("id", appid);
  p.put("botclass", "com.newbound.robot.published."+name);
  p.put("img", "/metabot/img/icon-square-app-builder.png");
  p.put("libraries", data.getString("db"));
  p.put("price", "0");
  p.put("forsale", "true");
  p.put("desc", "The "+name+" application");
  p.put("index", "index.html");
  p.put("version", "0");
  p.put("ctldb", data.getString("db"));
  p.put("ctlid", data.getString("ctl"));
  p.put("generate", "html,java");
}
return new JSONObject(p);