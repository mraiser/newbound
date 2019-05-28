package com.newbound.p2p.protocol;

import org.json.JSONObject;

import com.newbound.p2p.P2PService;
import com.newbound.robot.Callback;

public class NORELAY implements Callback {

	P2PService P2P;

	public NORELAY(P2PService p2p) 
	{
		super();
		P2P = p2p;
	}

	@Override
	public void execute(JSONObject data) 
	{
		try
		{
			String relay = data.getString("uuid");
			byte[] ba = (byte[])data.get("data");

			String target = new String(ba, 0, 36);
			System.out.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
			System.out.println(" REMOVING RELAY "+relay+" from "+target);
			System.out.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
			try { P2P.removeRelay(target, relay); } catch (Exception x) { x.printStackTrace(); }
		}
		catch (Exception x) { x.printStackTrace(); }
	}

}
