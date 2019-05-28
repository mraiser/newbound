package com.newbound.p2p;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.SocketAddress;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Vector;

import com.newbound.net.service.ServerSocket;
import com.newbound.net.service.Socket;
import com.newbound.robot.BotUtil;

public class RelayServerSocket implements ServerSocket 
{
	P2PManager P2P;
	
	Hashtable<String, Hashtable<String, RelaySocket>> SOCKS = new Hashtable();
	Vector<RelaySocket> INCOMING = new Vector();
	Object MUTEX = new Object();
	
	public RelayServerSocket(P2PManager p2p)
	{
		P2P = p2p;
	}

	@Override
	public SocketAddress getLocalSocketAddress() 
	{
		return P2P.getLocalSocketAddress();
	}
	
	public RelaySocket addRelay(String uuid, String relay) throws IOException
	{
		synchronized (MUTEX)
		{
			Hashtable<String, RelaySocket> hash = SOCKS.get(uuid);
			if (hash == null) SOCKS.put(uuid, hash = new Hashtable());
			RelaySocket sock = hash.get(relay);
			if (sock == null || sock.isClosed()) 
			{
				hash.put(relay, sock = new RelaySocket(relay, uuid));
/*				
				ByteArrayOutputStream os = new ByteArrayOutputStream();
				os.write(uuid.getBytes());
				os.write(BotUtil.intToBytes(0));
				os.flush();
				os.close();
				
				sock.incoming(os.toByteArray());
*/
				INCOMING.addElement(sock);
				MUTEX.notify();
			}
			
			return sock;
		}		
	}

	public void removeRelay(String uuid, String relay) throws IOException 
	{
		synchronized (MUTEX)
		{
			Hashtable<String, RelaySocket> hash = SOCKS.get(uuid);
			if (hash != null)
			{
				RelaySocket sock = hash.remove(relay);
				if (sock != null) 
				{
					INCOMING.remove(sock);
					sock.close();
				}
			}
		}
	}

	@Override
	public Socket accept() throws IOException 
	{
		synchronized (MUTEX)
		{
			if (INCOMING.size() == 0) try { MUTEX.wait(); } catch (Exception x) { x.printStackTrace(); }
			if (INCOMING.size() > 0) 
				return INCOMING.remove(0);
		}
		return null;
	}

	@Override
	public void close()
	{
		Enumeration<Hashtable<String, RelaySocket>> e = SOCKS.elements();
		while (e.hasMoreElements())
		{
			Enumeration<RelaySocket> e2 = e.nextElement().elements();
			while (e2.hasMoreElements()) try { e2.nextElement().close(); } catch (Exception x) { x.printStackTrace(); }
		}
		synchronized (MUTEX) { MUTEX.notifyAll(); }
	}

	@Override
	public InetAddress getInetAddress() 
	{
		return P2P.getInetAddress();
	}

	@Override
	public int getLocalPort() 
	{
		return P2P.getLocalPort();
	}

}
