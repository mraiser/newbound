package com.newbound.robot;

import java.util.Hashtable;

public class Session extends Hashtable
{
	public long expire = -1;
	public Session()
	{
		expire = System.currentTimeMillis() + BotBase.sessiontimeout;
	}
}