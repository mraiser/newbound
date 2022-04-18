class FileFinder {
  public JSONArray files = new JSONArray();
  public FileFinder(File dir)
  {
    findFiles(dir);
  }
  
  public void findFiles(File f){
    if (f.isDirectory())
    {
      String[] sa = f.list(new NoDotFilter());
      int i = sa.length;
      while (i-->0) findFiles(new File(f, sa[i]));
    }
    else files.put(f);
  }
  
  public boolean remove(File f)
  {
    int k = files.length();
    while (k-->0) if (files.get(k).equals(f)) break;
    if (k == -1) 
      return false; 
    else files.remove(k);
    return true;
  }
  
  public void removeDir(File dir)
  {
    FileFinder ff = new FileFinder(dir);
    int k = ff.files.length();
    while (k-->0) remove((File)ff.files.get(k));
    remove(dir);
  }
}

JSONObject installed = new JSONObject();
BotBase b = BotBase.getBot("botmanager");
BotBase m = BotBase.getBot("metabot");

File f = new File(b.getRootDir().getParentFile().getParentFile(), "data");
String[] sa = f.list();
int i;
for (i=0;i<sa.length;i++)
{
  String s = sa[i];
  File f2 = new File(f, s);
  if (f.isDirectory() && !s.startsWith(".") && b.hasData(s, "controls"))
  {
    FileFinder ff = new FileFinder(f2);
    JSONArray files = ff.files;
    installed.put(s, files);
    JSONArray list = b.getData(s, "controls").getJSONObject("data").getJSONArray("list");
    ff.remove(new File(BotUtil.getSubDir(f2, "assets", 4, 4), "assets"));
    ff.remove(new File(BotUtil.getSubDir(f2, "controls", 4, 4), "controls"));
    ff.remove(new File(BotUtil.getSubDir(f2, "tasklists", 4, 4), "tasklists"));
    ff.remove(new File(f2, "version.txt"));
    ff.remove(new File(f2, "meta.json"));
    ff.remove(new File(f2, "_APPS.hash"));
    ff.removeDir(new File(f2, "_ASSETS"));
    int j;
    for (j=0;j<list.length();j++){
      JSONObject ctl = list.getJSONObject(j);
      String id = ctl.getString("id");
      String ctlname = ctl.getString("name");
      ctl = b.getData(s, id).getJSONObject("data");
      File f3 = BotUtil.getSubDir(f2, id, 4, 4);
      f3 = new File(f3, id);
      
      if (!ff.remove(f3)) 
        break; // Not compatible with encrypted libraries
      
      if (ctl.has("attachmentkeynames")) {
        JSONArray ja = ctl.getJSONArray("attachmentkeynames");
        int k = ja.length();
        while (k-->0)
        {
          String suffix = ja.getString(k);
          File f4 = new File(f3.getParent(), id+"."+suffix);
//          System.out.println(f4);
          ff.remove(f4);
        }
      }
      
      if (ctl.has("timer"))
      {
        JSONArray ja = ctl.getJSONArray("timer");
        int k = ja.length();
        while (k-->0)
        {
          JSONObject timer = ja.getJSONObject(k);
          id = timer.getString("id");
          f3 = BotUtil.getSubDir(f2, id, 4, 4);
          f3 = new File(f3, id);
          ff.remove(f3);
        }
      }
      
      if (ctl.has("cmd"))
      {
        JSONArray ja = ctl.getJSONArray("cmd");
        int k = ja.length();
        while (k-->0)
        {
          JSONObject cmd = ja.getJSONObject(k);
          id = cmd.getString("id");
          String name = cmd.getString("name");
          cmd = b.getData(s, id).getJSONObject("data");
          f3 = BotUtil.getSubDir(f2, id, 4, 4);
          f3 = new File(f3, id);
          ff.remove(f3);
          String lang = "java";
          if (cmd.has("lang")) lang = cmd.getString("lang");
          else if (cmd.has("type")) lang = cmd.getString("type");
          if (cmd.has(lang) || cmd.has("cmd"))
          {
            id = cmd.has(lang) ? cmd.getString(lang) : cmd.getString("cmd");
            f3 = BotUtil.getSubDir(f2, id, 4, 4);
            f3 = new File(f3, id);
            ff.remove(f3);
          }
        }
      }
    }
  }
}
return installed;