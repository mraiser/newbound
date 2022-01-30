package com.newbound.robot;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.SocketException;

import com.newbound.net.service.Container;
import com.newbound.net.udp.UDPServerSocket;

public class DiscoveryServerSocket extends UDPServerSocket
{
	Container C;
	
	public DiscoveryServerSocket(Container c) throws SocketException 
	{
		super(null,5772);
		BUFLEN = 8;
		C = c;
	}
	
//	protected synchronized void route(DatagramPacket p) throws IOException
	protected void route(DatagramPacket p) throws IOException
	{
		String msg = new String(p.getData(), 0, 8);
		if (msg.equals("DISCOVER"))
		{
			String res = "{ \"uuid\": \""+C.getLocalID()+"\", \"name\": \""+C.getMachineID()+"\" }";
			byte[] ba2 = res.getBytes();
			DatagramPacket dp2 = new DatagramPacket(ba2, ba2.length, p.getAddress(), p.getPort());
			SOCK.send(dp2);
		}

	}
}
