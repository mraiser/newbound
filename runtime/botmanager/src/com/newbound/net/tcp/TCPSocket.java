package com.newbound.net.tcp;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.net.SocketException;
import java.net.UnknownHostException;

import com.newbound.net.service.Socket;

public class TCPSocket implements Socket 
{
	java.net.Socket S;
	
	public TCPSocket(java.net.Socket sock) throws IOException 
	{
		S = sock;
		S.setKeepAlive(true);
	}

	public TCPSocket(String dataSocketAddr, int dataSocketPort) throws IOException
	{
		this(new java.net.Socket(dataSocketAddr, dataSocketPort));
	}

	public TCPSocket(String dataSocketAddr, int dataSocketPort, int timeout) throws IOException {
		this(new java.net.Socket());
		S.connect(new InetSocketAddress(dataSocketAddr, dataSocketPort), timeout);
	}

	@Override
	public InputStream getInputStream() throws IOException 
	{
		return S.getInputStream();
	}

	@Override
	public OutputStream getOutputStream() throws IOException 
	{
		return S.getOutputStream();
	}

	@Override
	public void close() throws IOException 
	{
		S.close();
	}

	@Override
	public boolean isConnected() 
	{
		return S.isConnected();
	}

	@Override
	public boolean isClosed() 
	{
		return S.isClosed();
	}

	@Override
	public boolean isConnecting() 
	{
		return !(isConnected() || isClosed());
	}

	@Override
	public SocketAddress getRemoteSocketAddress() 
	{
		return S.getRemoteSocketAddress();
	}

	@Override
	public String getRemoteHostName() 
	{
		return S.getInetAddress().getHostName();
	}

	@Override
	public String getLocalHostName() 
	{
		return S.getLocalAddress().getHostName();
	}

	@Override
	public void setSoTimeout(int millis) throws IOException 
	{
		S.setSoTimeout(millis);
	}
}
