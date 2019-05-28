package com.newbound.p2p.protocol;

import org.json.JSONObject;

import com.newbound.p2p.P2PPeer;
import com.newbound.p2p.P2PService;
import com.newbound.robot.BotUtil;
import com.newbound.robot.Callback;

public class STREAM_DIED implements Callback 
{

	P2PService P2P;

	public STREAM_DIED(P2PService p2p) 
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
			P2PPeer p = P2P.getPeer(uuid);
			ba = p.decrypt(ba, 0, ba.length);
			p.closing = true; // FIXME - WTF?
			p.closeStream(BotUtil.bytesToLong(ba, 0));
		}
		catch (Exception x) { x.printStackTrace(); }
	}

}
