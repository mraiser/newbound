File f = new File(botmanager.getRootDir().getParentFile(), appid);
botmanager.deleteDir(f);

return "OK";