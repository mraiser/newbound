package com.newbound.p2p;

import org.json.JSONObject;

public abstract class P2PCallback 
{
	public abstract P2PCommand execute(JSONObject result);
	
	public P2PCallback()
	{
		super();
	}
}
