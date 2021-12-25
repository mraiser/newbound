Runnable cb = new Runnable(){
  public void run()
  {
    try { BotUtil.systemCall("reboot"); } catch (Exception x) { x.printStackTrace(); }
  }
};

BotBase.getBot("botmanager").setTimeout(cb, "REBOOT", 1000);

return "OK";