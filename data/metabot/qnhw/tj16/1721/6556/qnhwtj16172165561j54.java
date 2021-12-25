String appid = appinfo.getString("id");

JSONArray libs = appinfo.getJSONArray("libraries");
String lib = libs.getString(0); // FIXME - Assumes app is in lib 0

//File libzip = new File(metabot.getRootDir(), "libraries");
//File libjson = new File(libzip, lib+".json");

//JSONObject libinfo = new JSONObject(new String(metabot.readFile(libjson)));
//libzip = new File(libzip, lib+"_"+libinfo.getInt("version")+".zip");

//File tmp = metabot.newTempFile();
//metabot.unZip(libzip, tmp);

//File src = new File(tmp, "_APPS");
//src = new File(src, appid);
File dst = new File(metabot.getRootDir().getParentFile(), appid);
//metabot.copyFolder(src, dst);
//metabot.deleteDir(tmp);

String libstring = lib;
int n = libs.length();
int i;
for (i=1;i<n;i++) libstring += ","+libs.getString(i);

JSONArray gen = appinfo.getJSONArray("generate");
n = gen.length();
String genstring = n == 0 ? "" : gen.getString(0);
for (i=1;i<n;i++) genstring += ","+gen.getString(i);

File f = new File(dst, "app.properties");
Properties p = f.exists() ? metabot.loadProperties(f) : new Properties();

p.setProperty("ctldb", lib);
p.setProperty("id", appid);
p.setProperty("libraries", libstring);
p.setProperty("generate", genstring);
if (appinfo.has("hash")) p.setProperty("hash", appinfo.getString("hash"));
if (appinfo.has("botclass")) p.setProperty("botclass", appinfo.getString("class"));
if (appinfo.has("author")) p.setProperty("author", appinfo.getString("author"));
if (appinfo.has("authorname")) p.setProperty("authorname", appinfo.getString("authorname"));
if (appinfo.has("authororg")) p.setProperty("authororg", appinfo.getString("authororg"));
if (appinfo.has("version")) p.setProperty("version", appinfo.getString("version"));
if (appinfo.has("index")) p.setProperty("index", appinfo.getString("index"));
if (appinfo.has("signature")) p.setProperty("signature", appinfo.getString("signature"));
if (appinfo.has("id")) p.setProperty("id", appinfo.getString("id"));
if (appinfo.has("price")) p.setProperty("price", ""+appinfo.getDouble("price"));
if (appinfo.has("forsale")) p.setProperty("forsale", ""+appinfo.getBoolean("forsale"));
if (appinfo.has("desc")) p.setProperty("desc", appinfo.getString("desc"));
if (appinfo.has("vendorversion")) p.setProperty("vendorversion", appinfo.getString("vendorversion"));
if (appinfo.has("vendor")) p.setProperty("vendor", appinfo.getString("vendor"));
if (appinfo.has("key")) p.setProperty("key", appinfo.getString("key"));
if (appinfo.has("img")) p.setProperty("img", appinfo.getString("img"));
if (appinfo.has("name")) p.setProperty("name", appinfo.getString("name"));
              
metabot.storeProperties(p, f);

return "OK";