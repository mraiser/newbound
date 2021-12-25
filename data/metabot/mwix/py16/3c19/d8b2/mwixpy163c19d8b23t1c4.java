BotBase bb = metabot; 

File f = new File(bb.getRootDir(), "botd.properties");
Properties PROPERTIES = bb.loadProperties(f);

if (val != null)
{
  PROPERTIES.setProperty("autoupdate", ""+val.equals("true"));
  bb.storeProperties(PROPERTIES, f);
}

String autoupdate = PROPERTIES.getProperty("autoupdate", "false");

return autoupdate;