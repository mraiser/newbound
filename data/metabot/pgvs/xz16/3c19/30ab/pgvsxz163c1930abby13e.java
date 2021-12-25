java.io.File f = new java.io.File(botmanager.getRootDir().getParentFile().getParentFile(), "data");
f = new java.io.File(f, lib);
botmanager.deleteDir(f);

return new JSONObject();