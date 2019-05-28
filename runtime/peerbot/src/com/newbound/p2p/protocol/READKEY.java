package com.newbound.p2p.protocol;

import org.json.JSONObject;

import com.newbound.p2p.P2PPeer;
import com.newbound.p2p.P2PService;
import com.newbound.p2p.P2PSocket;
import com.newbound.robot.Callback;

public class READKEY implements Callback {

	P2PService P2P;

	public READKEY(P2PService p2p) 
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
			P2PSocket sock = (P2PSocket)data.get("p2psocket");
			P2PPeer p = P2P.getPeer(uuid);
			
			System.out.println("Got read key "+uuid);
			ba = P2P.decryptWithPrivateKey(uuid, ba, 0, ba.length);
			p.setReadKey(ba);
			sock.CONNECTING = false;
			P2P.isOK(uuid, sock, null, null);
		}
		catch (Exception x) { x.printStackTrace(); }
	}

}
