args.put("sessionid", sessionid);
return ((com.newbound.robot.MetaBot)BotBase.getBot("metabot")).call(db, name, cmd, args);