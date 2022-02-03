package com.newbound.p2p.protocol;

import org.json.JSONObject;

import com.newbound.net.service.Socket;
import com.newbound.p2p.P2PParser;
import com.newbound.p2p.P2PPeer;
import com.newbound.p2p.P2PService;
import com.newbound.p2p.P2PSocket;
import com.newbound.p2p.RelaySocket;
import com.newbound.robot.BotUtil;
import com.newbound.robot.Callback;

public class RELAYED implements Callback 
{
	P2PService P2P;

	public RELAYED(P2PService p2p) 
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
			P2PPeer p = P2P.getPeer(target);
			if (p.allow(p.ALLOW_RELAY)) {
				int code = BotUtil.bytesToInt(ba, 36);
/*
				// FIXME major hack
				if (ba.length == 76) {
					String s = new String(ba, 36, 36);
					if (s.equals(target)) try {
						int i = BotUtil.bytesToInt(ba, 72);
						//P2PPeer p = P2P.getPeer(s);
						if (p.getPort() == i)
							return;
					} catch (Exception x) {
						x.printStackTrace();
					}
				}
*/
				// FIXME maybe?
				int len = ba.length - 40;
				byte[] ba2 = new byte[len + 8];
				System.arraycopy(BotUtil.intToBytes(code), 0, ba2, 0, 4);
				System.arraycopy(BotUtil.intToBytes(len), 0, ba2, 4, 4);
				System.arraycopy(ba, 40, ba2, 8, len);

				try {
					//			P2PPeer p = P2P.getPeer(target);
					//			byte[] ba3 = p.decrypt(ba, 40, len-8);

					RelaySocket sock = P2P.getRelay(target, relay);
					sock.incoming(ba2);
				} catch (Exception x) {
					x.printStackTrace();
				}
			}
		}
		catch (Exception x) { x.printStackTrace(); }
	}

}
