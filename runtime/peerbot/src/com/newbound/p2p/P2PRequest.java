package com.newbound.p2p;

import org.json.JSONObject;

import com.newbound.net.service.Request;

public class P2PRequest implements Request 
{
	P2PSocket SOCK;
	String REMOTE;
	int CODE;
	byte[] BA;

	public P2PRequest(P2PSocket sock, String remoteid, int code, byte[] ba) 
	{
		REMOTE = remoteid;
		CODE = code;
		BA = ba;
		
//		System.out.println("INCOMING P2P "+ba.length+" BYTES "+code+" from "+remoteid);
	}

	@Override
	public Integer getCommand() 
	{
		return CODE;
	}

	public JSONObject toJSON() 
	{
		JSONObject j = new JSONObject();

		try
		{
			j.put("uuid", REMOTE);
			j.put("data", BA);
		}
		catch (Exception x) { x.printStackTrace(); }

		return j;
	}

	@Override
	public JSONObject getData() 
	{
		return toJSON();
	}

}
