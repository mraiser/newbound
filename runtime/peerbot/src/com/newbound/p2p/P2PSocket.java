package com.newbound.p2p;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.SocketAddress;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Vector;

import com.newbound.net.service.Socket;
import com.newbound.net.tcp.TCPSocket;
import com.newbound.util.ThreadedInputStream;
import com.newbound.util.ThreadedOutputStream;

public class P2PSocket implements Socket 
{
	protected P2PService P2P;
	protected P2PParser PARSER;
	protected String LOCALID;
	protected int PORT;
	
	protected Object SEND_MUTEX = new Object();
	
	public boolean CONNECTING = false;
		
	protected Socket SOCK;
	protected InputStream IS;
	protected OutputStream OS;
	
	public P2PSocket(P2PService p2p, String localid, int localport, Socket sock) throws IOException 
	{
		P2P = p2p;
		SOCK = sock;
		LOCALID = localid;
		PORT = localport;
		
		IS = SOCK.getInputStream();
		OS = SOCK.getOutputStream();
		
//		IS = new ThreadedInputStream(P2P.CONTAINER.getDefault(), SOCK.getInputStream());
//		OS = new ThreadedOutputStream(P2P.CONTAINER.getDefault(), SOCK.getOutputStream()); 
	}

	@Override
	public InputStream getInputStream() throws IOException 
	{
		return IS;
	}

	@Override
	public OutputStream getOutputStream() throws IOException 
	{
		return OS;
	}

	@Override
	public void close()
	{
		if (SOCK != null) try { SOCK.close(); } catch (Exception x) { x.printStackTrace(); } 
		SOCK = null;
		PARSER.close();
	}

	@Override
	public boolean isConnected() 
	{
		// FIXME hack
		return SOCK == null ? false : SOCK.isConnected();
	}

	@Override
	public boolean isClosed() 
	{
		// FIXME hack
		return SOCK == null ? true : SOCK.isClosed();
	}

	public void send(P2PResponse res) throws IOException 
	{
		PARSER.send(res);
	}

	@Override
	public boolean isConnecting() 
	{
		// FIXME hack
		return SOCK == null ? true : SOCK.isConnecting();
	}

	@Override
	public SocketAddress getRemoteSocketAddress() 
	{
		return SOCK.getRemoteSocketAddress();
	}

	@Override
	public String getRemoteHostName() throws IOException 
	{
		return SOCK.getRemoteHostName();
	}

	@Override
	public String getLocalHostName() throws IOException 
	{
		return SOCK.getLocalHostName();
	}

	@Override
	public void setSoTimeout(int millis) throws IOException 
	{
		SOCK.setSoTimeout(millis);
	}

	public Socket getSocket() 
	{
		return SOCK;
	}

	@Override
	public String toString() 
	{
		return "P2PSocket "+SOCK;
	}


}
