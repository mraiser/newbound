package com.newbound.p2p.protocol;

import java.net.InetSocketAddress;

import org.json.JSONObject;

import com.newbound.p2p.Codes;
import com.newbound.p2p.P2PService;
import com.newbound.p2p.P2PSocket;
import com.newbound.robot.Callback;

public class PING implements Callback 
{
	P2PService P2P;

	public PING(P2PService p2p) 
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
System.out.println(uuid+"/"+uuid2);

			P2PSocket sock = (P2PSocket)data.get("p2psocket");
			InetSocketAddress isa = (InetSocketAddress)sock.getRemoteSocketAddress();
//			P2P.sendPong(isa);
		}
		catch (Exception x)
		{
			x.printStackTrace();
		}
	}

}
