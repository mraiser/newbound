package com.newbound.p2p.protocol;

import javax.crypto.BadPaddingException;

import org.json.JSONObject;

import com.newbound.crypto.SuperSimpleCipher;
import com.newbound.p2p.Codes;
import com.newbound.p2p.P2PParser;
import com.newbound.p2p.P2PPeer;
import com.newbound.p2p.P2PRequest;
import com.newbound.p2p.P2PService;
import com.newbound.p2p.P2PSocket;
import com.newbound.robot.Callback;

public class COMMAND implements Callback {

	P2PService P2P;

	public COMMAND(P2PService p2p) 
	{
		super();
		P2P = p2p;
	}

	@Override
	public void execute(final JSONObject data) 
	{
		final Callback me = this;
		
		P2P.CONTAINER.getDefault().addJob(new Runnable() 
		{
			@Override
			public void run() 
			{
				try
				{
					String uuid = data.getString("uuid");
					byte[] ba = (byte[])data.get("data");
					P2PSocket sock = (P2PSocket)data.get("p2psocket");

					if (P2P.isOK(uuid, sock, me, data)) try
					{
						P2PPeer p = P2P.getPeer(uuid);
						p.setConnected(true);
//						p.setLastContact(System.currentTimeMillis());

						ba = p.decrypt(ba, 0, ba.length);

						p.command(ba);
					}
					catch (BadPaddingException x)
					{
						try { P2P.getPeer(uuid).setReadKey((SuperSimpleCipher)null); } catch (Exception x2) {x2.printStackTrace();}
						P2P.isOK(uuid, sock, me, data);
					}
					catch (Exception x) { x.printStackTrace(); }
				}
				catch (Exception x) { x.printStackTrace(); }
			}
		}, "Executing P2P command");
	}

}
