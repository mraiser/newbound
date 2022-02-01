package com.newbound.p2p;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.net.SocketTimeoutException;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Vector;

import com.newbound.net.tcp.TCPSocket;
import com.newbound.net.udp.UDPSocket;
import com.newbound.robot.Callback;
import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.net.service.ServerSocket;
import com.newbound.net.service.Socket;
import com.newbound.net.tcp.TCPServerSocket;
//import com.newbound.net.udp.UDPMessage;
import com.newbound.net.udp.UDPServerSocket;
//import com.newbound.net.udp.UDPSocket;
import com.newbound.robot.BotUtil;

public class P2PServerSocket implements ServerSocket 
{
	boolean RUNNING = false;
	
	P2PManager P2P;

	TCPServerSocket TCP;
	UDPServerSocket UDP;
	RelayServerSocket RELAY;

	Vector<P2PSocket> INCOMING = new Vector();
	Vector<P2PPeer> CHECKING = new Vector();
	Object MUTEX = new Object();
	
	String UUID;
	int PORT;

	public P2PServerSocket(P2PManager p2p, String uuid, int port) throws IOException 
	{
		RUNNING = true;
		UUID = uuid;
		P2P = p2p;
		PORT = port;
		
		TCP = new TCPServerSocket(port);
		listen(TCP);
		
		port = PORT = TCP.getLocalPort();
		
		UDP = new UDPServerSocket(p2p, port);
		listen(UDP);
		
		RELAY = new RelayServerSocket(P2P);
		listen(RELAY);
		
		P2P.addPeriodicTask(new Runnable() {
			
			@Override
			public void run() 
			{
				try { maintenance(); } catch (Exception x) { x.printStackTrace(); }
			}
		}, 20000, "P2P SERVER SOCKET MAINTENANCE");

		p2p.addEventListener("disconnect", new Callback() {
			@Override
			public void execute(JSONObject data) {
				checking.remove(data.getString("id"));
			}
		});
	}

	private void listen(final ServerSocket SS) 
	{
		P2P.addJob(new Runnable() 
		{
			@Override
			public void run() 
			{
				while (RUNNING) try 
				{
					Socket sock = SS.accept();
					
					synchronized(MUTEX) 
					{
						P2PSocket psock = new P2PSocket(P2P.P2P, UUID, PORT, sock);
						INCOMING.addElement(psock);
						MUTEX.notify();
					}
				}
				catch (SocketTimeoutException x) {}
				catch (Exception x) { x.printStackTrace(); }
			}
		}, "SERVER SOCKET ACCEPT "+SS.getClass().getName());
		
	}

	@Override
	public Socket accept() throws IOException 
	{
		synchronized (MUTEX)
		{
			if (INCOMING.size() == 0) try { MUTEX.wait(); } catch (Exception x) {}
			if (INCOMING.size() == 0) return null;
			P2PSocket sock = INCOMING.remove(0);
			return sock;
		}
	}
	
	//int mod = -2;
	
	protected void maintenance() throws Exception
	{
		P2PParser.maintenance();
		//mod++;
		if (false) //(mod++ % 10 == 0)
		{
			Iterator<Thread> it = Thread.getAllStackTraces().keySet().iterator();
			while (it.hasNext())
			{
				Thread t = it.next();
				if (!t.toString().startsWith("Thread[No work,"))
				{
					System.out.println("THREAD: "+t);
				}
			}
		}

//		if (false)
		{
			JSONArray ja = new JSONArray(); //P2P.myPeers();
			Enumeration<String> it = PeerManager.loaded(); //P2P.connected();
			while (it.hasMoreElements()) ja.put(it.nextElement());

			Vector<String> brokers = new Vector();
			String UUIDS = "";
			int i = ja.length();
			while (i-- > 0) try {
				final String uuid = ja.getString(i);
				if (UUIDS.indexOf(uuid) == -1) {
					UUIDS += UUIDS.equals("") ? uuid : " " + uuid;
					//if (P2P.isLoaded(uuid))
					{
						final P2PPeer p = P2P.getPeer(uuid);

						//if (p.isRelay()) { // FIXME - pretending the connection is good doesn't mean the connection is good.
						//	p.setConnected(true);
						//	p.updateLastContact();
						//}

						//					if (p.isConnected() && System.currentTimeMillis() - p.lastContact() > 35000) p.disconnect();
						//					else
						if (p.isTCP()) {
							if (!brokers.contains(uuid)) {
								brokers.addElement(uuid);
							}
						}
						else {
							if (p.isConnected() && CHECKING.indexOf(p) == -1) CHECKING.addElement(p);
						}

						if (p.keepAlive() && !p.isConnected()) P2P.connect(uuid);

						if (p.isConnected() && p.lastContact() > 30000)
							p.sendCommandAsync("peerbot", "getpeerinfo", new Hashtable<String, String>(), new P2PCallback() {

								@Override
								public P2PCommand execute(JSONObject result) {
//									System.out.println("Heartbeat " + p.getName() + "/" + p.getID() + " " + result);

									try {
										String name = result.getString("name");
										String localip = result.getString("localip");
										String addr = result.getString("addr");
										int port = result.getInt("port");

										if (!name.equals(p.getName())) p.setName(name);

										p.addOtherAddress(localip);
										p.addOtherAddress(addr);

										if (result.has("localaddresses")) {
											JSONObject jo = result.getJSONObject("localaddresses");
											JSONArray ja = jo.getJSONArray("link");
											int i = ja.length();
											while (i-- > 0)
												p.addOtherAddress(ja.getString(i));
											ja = jo.getJSONArray("site");
											i = ja.length();
											while (i-- > 0)
												p.addOtherAddress(ja.getString(i));
										}
									} catch (Exception x) {
										x.printStackTrace();
									}

									return null;
								}
							});
					}
				}
			} catch (Exception x) {
				x.printStackTrace();
			}

			if (CHECKING.size()>0)
			{
				P2PPeer peer = (P2PPeer) CHECKING.remove(0);
				try {
 					if (peer.isConnected() && !peer.isTCP() && peer.allow(peer.ALLOW_TCP))
						 P2P.initiateTCPConnection(peer);
				} catch (Exception x) {
					//System.out.println("Unable to reach " + peer.getName() + " at " + isa + " (" + x.getMessage() + ")");
				}
/* xxx but also, this is bad code
				peer.mKnownAddresses.removeElement(isa);
				try {
					P2P.savePeer(peer);
				} catch (Exception x) {
					x.printStackTrace();
				}
*/
			}
			if (!UUIDS.equals("")) // && mod % 6 == 0)
			{
				Hashtable h = new Hashtable();
				h.put("uuids", UUIDS);
				Enumeration<String> e = brokers.elements();
				checkPeers(e, h);
			}
		}
	}

	private static Hashtable<String, Long> checking = new Hashtable();
	private void checkPeers(final Enumeration<String> e, final Hashtable h) 
	{
		if (e.hasMoreElements())
		{
			final String relay = e.nextElement();
			if (checking.get(relay) != null)
			{
				long dur = System.currentTimeMillis()-checking.get(relay);
				if (dur<120000)
					System.out.println("Still checking relay "+relay+" after "+dur+" ms");
				else try {
					P2P.disconnect(relay);
				}
				catch (Exception x) { x.printStackTrace(); }
			}
			else
			{
				checking.put(relay, System.currentTimeMillis());
				P2PCallback cb = new P2PCallback()
				{
					public P2PCommand execute(JSONObject result)
					{
						checking.remove(relay);
						Iterator<String> i = result.keys();
						while (i.hasNext()) try
						{
							Object o = result.get(i.next());
							if (o instanceof JSONObject)
							{
								JSONObject p = (JSONObject) o;
								if (p.has("tcp") && p.getBoolean("tcp"))
								{
									String peerid = p.getString("uuid");
									P2PPeer local = P2P.getPeer(peerid);
									if (local.allow(P2PPeer.ALLOW_RELAY)){
										RELAY.addRelay(peerid, relay);
										local.updateLastContact();
									}
								}
								else if (p.has("uuid"))
									RELAY.removeRelay(p.getString("uuid"), relay);
								else
									System.out.println("Unexpected response from "+relay+": " + p);
								if (p.has("addresses"))
								{
									String[] addr = p.getString("addresses").split(",");
									int port = p.getInt("port");
									if (port != -1)
									{
										int j = addr.length;
										while (j-- > 0)
											// xxx P2P.addInetSocketAddress(p.getString("uuid"), new InetSocketAddress(addr[j], port));
											P2P.getPeer(p.getString("uuid")).addOtherAddress(addr[j]);
									}
								}
							}
						}
						catch (Exception x)
						{
							x.printStackTrace();
						}

						checkPeers(e, h);

						return null;
					}
				};

				P2PCommand cmd = new P2PCommand("peerbot", "lookup", h, cb);
				try
				{
					P2P.sendCommand(P2P.getPeer(relay), cmd);
				}
				catch (Exception x)
				{
					checking.remove(relay);
					x.printStackTrace();
				}
			}
		}
	}

	@Override
	public SocketAddress getLocalSocketAddress() 
	{
		return TCP.getLocalSocketAddress();
	}

	@Override
	public void close() throws IOException 
	{
		RUNNING = false;
		TCP.close();
		UDP.close();
		RELAY.close();
		synchronized (MUTEX) { MUTEX.notifyAll(); }
	}

	public RelaySocket addRelay(String uuid, String relay) throws IOException 
	{
		return RELAY.addRelay(uuid, relay);
	}

	public void removeRelay(String target, String relay) throws IOException 
	{
		RELAY.removeRelay(target, relay);
	}

	@Override
	public InetAddress getInetAddress() 
	{
		return TCP.getInetAddress();
	}

	@Override
	public int getLocalPort() 
	{
		return TCP.getLocalPort();
	}
/*
	public void sendUDP(InetSocketAddress isa, int code, byte[] ba) throws Exception 
	{
		UDPServerSocket ss = UDP.get(PORT);
		UDPSocket udpsock = new UDPSocket(PORT, isa.getHostString(), isa.getPort());
		OutputStream OUT = udpsock.getOutputStream(); 
		
		int off = 0;
		int len = ba.length;
		OUT.write(BotUtil.intToBytes(code));
		OUT.write(BotUtil.intToBytes(len));
		OUT.write(ba, off, len);
		OUT.flush();
	}

	public void sendPing(InetSocketAddress isa) throws Exception
	{
		UDP.sendBytes(isa, Codes.PING, P2P.getLocalID().getBytes());
	}

	public void sendPong(InetSocketAddress isa) throws Exception
	{
		UDP.sendBytes(isa, Codes.PONG, P2P.getLocalID().getBytes());
	}
*/
}
