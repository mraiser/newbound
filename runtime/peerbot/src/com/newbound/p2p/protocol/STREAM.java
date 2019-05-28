package com.newbound.p2p.protocol;

import javax.crypto.BadPaddingException;

import org.json.JSONObject;

import com.newbound.crypto.SuperSimpleCipher;
import com.newbound.p2p.P2PPeer;
import com.newbound.p2p.P2PService;
import com.newbound.p2p.P2PSocket;
import com.newbound.robot.Callback;

public class STREAM implements Callback {

	P2PService P2P;

	public STREAM(P2PService p2p) 
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
			try
			{
				if (P2P.isOK(uuid, sock, this, data))
				{
					P2PPeer p = P2P.getPeer(uuid);

					ba = p.decrypt(ba, 0, ba.length);

//					p.setLastContact(System.currentTimeMillis());
					p.stream(ba);
				}
			}
			catch (BadPaddingException x)
			{
				try { P2P.getPeer(uuid).setReadKey((SuperSimpleCipher)null); } catch (Exception x2) {x2.printStackTrace();}
				P2P.isOK(uuid, sock, this, data);
			}
			catch (Exception x) { x.printStackTrace(); }
		}
		catch (Exception x) { x.printStackTrace(); }
	}

}
