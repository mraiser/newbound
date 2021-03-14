package com.newbound.p2p;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Vector;

import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.net.service.ServerSocket;
import com.newbound.net.service.Socket;
import com.newbound.net.tcp.TCPServerSocket;
import com.newbound.net.udp.UDPMessage;
import com.newbound.net.udp.UDPServerSocket;
import com.newbound.net.udp.UDPSocket;
import com.newbound.robot.BotUtil;

public class P2PServerSocket implements ServerSocket 
{
	boolean RUNNING = false;
	
	P2PManager P2P;

	TCPServerSocket TCP;
//	UDPServerSocket UDP;
	RelayServerSocket RELAY;
	
	Vector<P2PSocket> INCOMING = new Vector();
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
		
//		UDP = new UDPServerSocket(port);
//		listen(UDP);
		
		RELAY = new RelayServerSocket(P2P);
		listen(RELAY);
		
		P2P.addPeriodicTask(new Runnable() {
			
			@Override
			public void run() 
			{
				try { maintenance(); } catch (Exception x) { x.printStackTrace(); }
			}
		}, 5000, "P2P SERVER SOCKET MAINTENANCE");
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
			return INCOMING.remove(0);
		}
	}
	
	int mod = 0;
	
	protected void maintenance() throws Exception
	{
		P2PParser.maintenance();
		mod++;
		if (true) //(mod++ % 10 == 0)
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
			JSONArray ja = P2P.knownPeers();
			Vector<String> brokers = new Vector();
			String UUIDS = "";
			int i = ja.length();
			while (i-->0) try
			{
				final String uuid = ja.getString(i);
				UUIDS += UUIDS.equals("") ? uuid : " "+uuid;
				if (P2P.isLoaded(uuid))
				{
					final P2PPeer p = P2P.getPeer(uuid);
					
					if (p.isRelay())
					{
						p.setConnected(true);
						p.updateLastContact();
					}
					
//					if (p.isConnected() && System.currentTimeMillis() - p.lastContact() > 35000) p.disconnect();
//					else 
						if (p.isTCP()) {
							brokers.addElement(uuid);
						}
				
					if (p.keepAlive() && !p.isConnected()) P2P.connect(uuid);
	
					if (p.isTCP() && p.isConnected() && p.lastContact() > 30000)
						p.sendCommandAsync("peerbot", "getpeerinfo", new Hashtable<String, String>(), new P2PCallback() {
							
							@Override
							public P2PCommand execute(JSONObject result) 
							{
								System.out.println("Heartbeat "+p.getName()+"/"+p.getID()+" "+result);
	
								try
								{
									String name = result.getString("name");
									String localip = result.getString("localip");
									String addr = result.getString("addr");
									int port = result.getInt("port");
	
									if (!name.equals(p.getName())) p.setName(name);
	
									p.addSocketAddress(new InetSocketAddress(localip, port));
									p.addSocketAddress(new InetSocketAddress(addr, port));

									if (result.has("localaddresses"))
									{
										JSONObject jo = result.getJSONObject("localaddresses");
										JSONArray ja = jo.getJSONArray("link");
										int i = ja.length();
										while (i-->0) p.addSocketAddress(new InetSocketAddress(ja.getString(i), port));
										ja = jo.getJSONArray("site");
										i = ja.length();
										while (i-->0) p.addSocketAddress(new InetSocketAddress(ja.getString(i), port));
									}
								}
								catch (Exception x) { x.printStackTrace(); }
								
								return null;
							}
						});
				}
			}
			catch (Exception x) { x.printStackTrace(); }
	
			if (!UUIDS.equals("") && mod % 6 == 0)
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
				System.out.println("Still checking relay "+relay+" after "+(System.currentTimeMillis()-checking.get(relay))+" ms");
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
									RELAY.addRelay(peerid, relay);
									P2P.getPeer(peerid).updateLastContact();
								}
								else if (p.has("uuid"))
									RELAY.removeRelay(p.getString("uuid"), relay);
								else
									System.out.println("Unexpected response: " + p);
								if (p.has("addresses"))
								{
									String[] addr = p.getString("addresses").split(",");
									int port = p.getInt("port");
									if (port != -1)
									{
										int j = addr.length;
										while (j-- > 0)
											P2P.addInetSocketAddress(p.getString("uuid"), new InetSocketAddress(addr[j], port));
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
//		UDP.close();
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
