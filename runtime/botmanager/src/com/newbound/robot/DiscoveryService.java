package com.newbound.robot;

import java.io.IOException;

import com.newbound.net.service.Container;
import com.newbound.net.service.Parser;
import com.newbound.net.service.Service;
import com.newbound.net.udp.UDPServerSocket;

class DiscoveryService extends Service
{
	public DiscoveryService(Container c) throws IOException 
	{
		super(new DiscoveryServerSocket(c), "DISCOVERY", Parser.class, c);
	}
}