package com.newbound.p2p.protocol;

import org.json.JSONObject;

import com.newbound.p2p.Codes;
import com.newbound.p2p.P2PPeer;
import com.newbound.p2p.P2PService;
import com.newbound.p2p.P2PSocket;
import com.newbound.robot.Callback;

public class SEND_READKEY implements Callback {

	P2PService P2P;

	public SEND_READKEY(P2PService p2p) 
	{
		super();
		P2P = p2p;
	}

	@Override
	public void execute(final JSONObject data) 
	{
		try
		{
			String uuid = data.getString("uuid");
			System.out.println("Got read key request from "+uuid);
			P2PPeer p = P2P.getPeer(uuid);
			if (p.getPublicKey() == null) 
			{
				P2PSocket sock = (P2PSocket)data.get("p2psocket");
	
				if (!sock.CONNECTING) P2P.send(uuid, "".getBytes(), Codes.SEND_PUBKEY);
				sock.CONNECTING = true;
				
				System.out.println("Deferring read key request "+uuid);
				
				P2P.setTimeout(new Runnable() 
				{
					@Override
					public void run() 
					{
						execute(data);
					}
				}, "P2PSocket connecting, waiting to execute command", 100);
			}
			else
			{
				byte[] ba2 = p.getWriteKey().toBytes(); // Their read key is my write key
				if (!P2P.send(uuid, P2P.encryptWithPrivateKey(uuid, ba2, 0, ba2.length), Codes.READKEY)) 
					System.out.println("Unable to send read key "+uuid);
				else System.out.println("Read key sent to "+uuid);
			}
		}
		catch (Exception x)
		{
			x.printStackTrace();
		}
	}
}
