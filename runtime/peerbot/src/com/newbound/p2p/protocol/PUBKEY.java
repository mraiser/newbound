package com.newbound.p2p.protocol;

import org.json.JSONObject;

import com.newbound.p2p.Codes;
import com.newbound.p2p.P2PPeer;
import com.newbound.p2p.P2PResponse;
import com.newbound.p2p.P2PService;
import com.newbound.p2p.P2PSocket;
import com.newbound.robot.Callback;

public class PUBKEY implements Callback {

	P2PService P2P;

	public PUBKEY(P2PService p2p) 
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
			System.out.println("Got public key "+uuid);
			if (p.getPublicKey() == null) 
			{
				p.setPublicKey(ba);
//				sock.CONNECTING = false;
				
				if (p.getReadKey() == null)
				{
					sock.CONNECTING = true;
					sock.send(new P2PResponse(Codes.SEND_READKEY, "".getBytes()));
				}
				
			}
			else System.out.println("Already had a public key!!! Ignoring.");
			P2P.isOK(uuid, sock, null, null); 
		}
		catch (Exception x) { x.printStackTrace(); }
	}

}
