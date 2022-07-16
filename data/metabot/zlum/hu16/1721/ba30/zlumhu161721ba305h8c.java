metabot.checkForUpdates(null, sessionid);

File root = metabot.getRootDir().getParentFile();
File zip = new File(root, "botmanager");
zip = new File(zip, "src");
zip = new File(zip, "com");
zip = new File(zip, "newbound");
zip = new File(zip, "launcher");
zip = new File(zip, "src.zip");
if (zip.exists())
{
  File dst = new File(root.getParentFile(), "src");
  metabot.unZip(zip, dst);
}

return "OK";