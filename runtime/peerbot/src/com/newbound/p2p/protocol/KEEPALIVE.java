package com.newbound.p2p.protocol;

import org.json.JSONObject;

import com.newbound.p2p.Codes;
import com.newbound.p2p.P2PService;
import com.newbound.p2p.P2PSocket;
import com.newbound.robot.Callback;

public class KEEPALIVE implements Callback 
{
	P2PService P2P;

	public KEEPALIVE(P2PService p2p) 
	{
		super();
		P2P = p2p;
	}

	@Override
	public void execute(JSONObject data) 
	{
		try
		{
			String uuid = data.getString("uuid");
			P2PSocket sock = (P2PSocket)data.get("p2psocket");
			System.out.println("got KEEPALIVE from "+uuid+" via "+sock.toString());
		}
		catch (Exception x)
		{
			x.printStackTrace();
		}
	}

}
