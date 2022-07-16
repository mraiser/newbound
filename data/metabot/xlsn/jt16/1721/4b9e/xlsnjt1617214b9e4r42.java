args.put("sessionid", sessionid);
return BotBase.getBot("metabot").call(db, name, cmd, args);