package com.newbound.net.tcp;

import java.io.IOException;
import java.net.InetAddress;
import java.net.SocketAddress;

import com.newbound.net.service.ServerSocket;
import com.newbound.net.service.Socket;

public class TCPServerSocket implements ServerSocket 
{
	java.net.ServerSocket SS;

	public TCPServerSocket(int port) throws IOException 
	{
		SS = new java.net.ServerSocket(port);
		SS.setSoTimeout(600000);
	}

	@Override
	public Socket accept() throws IOException 
	{
		java.net.Socket sock = SS.accept();
		return new TCPSocket(sock);
	}

	@Override
	public SocketAddress getLocalSocketAddress() 
	{
		return SS.getLocalSocketAddress();
	}

	@Override
	public void close() throws IOException 
	{
		SS.close();
	}

	@Override
	public InetAddress getInetAddress() 
	{
		return SS.getInetAddress();
	}

	@Override
	public int getLocalPort() 
	{
		return SS.getLocalPort();
	}
}
