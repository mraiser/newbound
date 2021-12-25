if (!botmanager.getClass().getName().equals(classname))
{
  java.io.File f = new java.io.File(botmanager.getRootDir(), "botd.properties");
  java.util.Properties p = botmanager.loadProperties(f);
  String bots = p.getProperty("bots")+","+classname;
  
  Vector<String> v = new Vector();
  String[] list = bots.split(",");
  bots = "";
  for (int i=0;i<list.length;i++)
  {
    if (v.indexOf(list[i]) == -1) 
    {
      v.addElement(list[i]);
      if (!bots.equals("")) bots += ",";
      bots += list[i];
    }
  }
  
  p.setProperty("bots", bots);
  botmanager.storeProperties(p, f);
}

return new JSONObject();