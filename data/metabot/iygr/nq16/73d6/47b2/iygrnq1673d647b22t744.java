String[] ctls = { 
  "{\"title\":\"Reboot Button\",\"type\":\"metabot:rebootbutton\",\"big\":false,\"position\":\"menubar\",\"groups\":[\"admin\"]}"
};

BotBase b = BotBase.getBot("botmanager");

JSONObject jo = new JSONObject();
JSONArray ja = new JSONArray();

if (b.hasData("runtime", "availablecontrols")) try { ja = b.getData("runtime", "availablecontrols").getJSONObject("data").getJSONArray("list"); } 
catch (Exception x) { x.printStackTrace(); }
  
int n = ctls.length;
while (n-->0)
{
  JSONObject jo2 = new JSONObject(ctls[n]);
  String type = jo2.getString("type");

  JSONObject ctl = null;
  int i = ja.length();
  while (i-->0) if (ja.getJSONObject(i).getString("type").equals(type)) { ctl = ja.getJSONObject(i); break; }
  if (ctl == null)
  {
    ctl = jo2;
    ctl.put("id", b.uniqueSessionID());
    ja.put(ctl);
  }
}
jo.put("list", ja);

try { b.newDB("runtime", null, null); } catch (Exception x) {}

b.setData("runtime", "availablecontrols", jo, null, null);

return jo;