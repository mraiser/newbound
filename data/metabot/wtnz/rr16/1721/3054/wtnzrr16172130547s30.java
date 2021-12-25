File f = new File(botmanager.getRootDir().getParentFile(), id);
f = new File(f, "app.properties");
if (f.exists()){
  Properties p = botmanager.loadProperties(f);
  JSONObject jo = new JSONObject(p);
  return jo;
}

throw new Exception("No such app: "+id);