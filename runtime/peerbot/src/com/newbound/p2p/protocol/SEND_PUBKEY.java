package com.newbound.p2p.protocol;

import org.json.JSONObject;

import com.newbound.p2p.Codes;
import com.newbound.p2p.P2PService;
import com.newbound.p2p.P2PSocket;
import com.newbound.robot.Callback;

public class SEND_PUBKEY implements Callback {

	P2PService P2P;

	public SEND_PUBKEY(P2PService p2p) 
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
			try { P2P.send(uuid, P2P.getPublicKey(), Codes.PUBKEY); } catch (Exception x) { x.printStackTrace(); }
			P2PSocket sock = (P2PSocket)data.get("p2psocket");
			P2P.isOK(uuid, sock, null, null);
		}
		catch (Exception x) { x.printStackTrace(); }
	}

}
