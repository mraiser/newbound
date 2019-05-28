package com.newbound.p2p;

import java.util.Hashtable;

import org.json.JSONObject;

public class P2PCommand 
{
	protected String mBot = null;
	protected String mCmd = null;
	protected Hashtable<String, String> mParams = null;
	protected P2PCallback mP2PCallback = null;
	
	protected long mID = -1;
	
	public P2PCommand(String bot, String cmd)
	{
		this(bot, cmd, new Hashtable<String, String>());
	}
	
	public P2PCommand(String bot, String cmd, Hashtable<String, String> params)
	{
		this(bot, cmd, params, null);
	}
	
	public P2PCommand(String bot, String cmd, Hashtable<String, String> params, P2PCallback cb)
	{
		super();
		mBot = bot;
		mCmd = cmd;
		mParams = params;
		mP2PCallback = cb;
	}

	public String getBot() {
		return mBot;
	}

	public void setBot(String mBot) {
		this.mBot = mBot;
	}

	public String getCmd() {
		return mCmd;
	}

	public void setCmd(String mCmd) {
		this.mCmd = mCmd;
	}

	public Hashtable<String, String> getParams() {
		return mParams;
	}

	public void setParams(Hashtable<String, String> mParams) {
		this.mParams = mParams;
	}

	public P2PCallback getP2PCallback() {
		return mP2PCallback;
	}

	public void setP2PCallback(P2PCallback mP2PCallback) {
		this.mP2PCallback = mP2PCallback;
	}

	public String toString() 
	{
		return toJSON().toString();
	}
	
	public JSONObject toJSON()
	{
		JSONObject o = new JSONObject();

		try
		{
			o.put("id", mID);
			o.put("bot", mBot);
			o.put("cmd", mCmd);
			JSONObject params = new JSONObject(mParams);
			o.put("params", params);
			return o;
		}
		catch (Exception x) { x.printStackTrace(); }
		
		return o;
	}
}
