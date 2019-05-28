package com.newbound.p2p.protocol;

import org.json.JSONObject;

import com.newbound.p2p.Codes;
import com.newbound.p2p.P2PService;
import com.newbound.robot.Callback;

public class RELAY implements Callback 
{
	P2PService P2P;

	public RELAY(P2PService p2p) 
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
			byte[] ba = (byte[])data.get("data");
			
			String uuid2 = new String(ba, 0, 36);
			System.arraycopy(uuid.getBytes(), 0, ba, 0, 36);
			if (!P2P.sendTCP(uuid2, ba, Codes.RELAYED)) P2P.sendTCP(uuid, uuid2.getBytes(), Codes.NORELAY);
		}
		catch (Exception x)
		{
			x.printStackTrace();
		}
	}

}
