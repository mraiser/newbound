package com.newbound.net.service.http;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.SocketAddress;

import com.newbound.net.service.Socket;

public class WebSocket implements Socket
{
	Socket mSocket = null;
	
	public WebSocket(Socket sock) throws IOException 
	{
		mSocket = sock;
		sock.setSoTimeout(0);
	}

	public InputStream getInputStream() throws IOException 
	{
		return mSocket.getInputStream();
	}

	public boolean isConnected() 
	{
		return mSocket.isConnected() && !mSocket.isClosed();
	}

	public void close() throws IOException 
	{
		mSocket.close();
	}

	public OutputStream getOutputStream() throws IOException 
	{
		return mSocket.getOutputStream();
	}

	public void sendWebsocketMessage(byte[] msg, int offset, int len, boolean bytes) throws IOException
	{
		int i = 0;
		long n = len;
		byte[] reply = new byte[(int)n+10];
		
		reply[i++] = (byte)(129 + (bytes ? 1 : 0));
		
		if (n < 126)
		{
			reply[i++] = (byte)n;
		}
		else if (n < 65536)
		{
			reply[i++] = 126;
			reply[i++] = (byte)((n >> 8) & 0xFF);
			reply[i++] = (byte)(n & 0xFF);
		}
		else
		{
			reply[i++] = 127;
			reply[i++] = (byte)((n >> 56) & 0xFF);
			reply[i++] = (byte)((n >> 48) & 0xFF);
			reply[i++] = (byte)((n >> 40) & 0xFF);
			reply[i++] = (byte)((n >> 32) & 0xFF);
			reply[i++] = (byte)((n >> 24) & 0xFF);
			reply[i++] = (byte)((n >> 16) & 0xFF);
			reply[i++] = (byte)((n >> 8) & 0xFF);
			reply[i++] = (byte)(n & 0xFF);
		}
		
		System.arraycopy(msg, offset, reply, i, (int)n);
		getOutputStream().write(reply, 0, i+(int)n);
		getOutputStream().flush();
	}

	@Override
	public boolean isClosed() 
	{
		return mSocket.isClosed();
	}

	@Override
	public boolean isConnecting() 
	{
		return mSocket.isConnecting();
	}

	@Override
	public SocketAddress getRemoteSocketAddress() 
	{
		return mSocket.getRemoteSocketAddress();
	}

	@Override
	public String getRemoteHostName() throws IOException 
	{
		return mSocket.getRemoteHostName();
	}

	@Override
	public String getLocalHostName() throws IOException 
	{
		return mSocket.getLocalHostName();
	}

	@Override
	public void setSoTimeout(int millis) throws IOException 
	{
		mSocket.setSoTimeout(millis);
	}
}
