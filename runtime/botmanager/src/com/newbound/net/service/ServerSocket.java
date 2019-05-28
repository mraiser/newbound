package com.newbound.net.service;

import java.io.IOException;
import java.net.InetAddress;
import java.net.SocketAddress;

public interface ServerSocket 
{
	public Socket accept() throws IOException;
	public SocketAddress getLocalSocketAddress();
	public InetAddress getInetAddress();
	public int getLocalPort();
	public void close() throws IOException;
}
