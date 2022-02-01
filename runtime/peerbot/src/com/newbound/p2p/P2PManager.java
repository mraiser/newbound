package com.newbound.p2p;

import java.io.File;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.net.UnknownHostException;
import java.util.*;

import com.newbound.net.service.Socket;
import com.newbound.net.udp.UDPServerSocket;
import com.newbound.robot.Callback;
import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.crypto.SuperSimpleCipher;
import com.newbound.net.service.Parser;
import com.newbound.net.service.App;
import com.newbound.net.service.Container;
import com.newbound.net.tcp.TCPSocket;
import com.newbound.net.udp.UDPSocket;
import com.newbound.robot.BotUtil;
import com.newbound.robot.PeerBot;
import com.newbound.util.IsRunning;

public class P2PManager implements Container
{
	PeerBot mBot;
	PeerManager PEERS;
	
	String ID;
	int PORT;
	
	private byte[] PUBLIC;
	private byte[] PRIVATE;
	
	protected P2PService P2P;
	
	public IsRunning ISRUNNING = new IsRunning() 
	{
		@Override
		public boolean isRunning() 
		{
			return P2P.ISRUNNING.isRunning();
		}
	};

	public P2PManager(PeerBot peerBot, String uuid, int port, byte[] privateKey, byte[] publicKey) 
	{
		super();
		mBot = peerBot;
		ID = uuid;
		PORT = port;
		PUBLIC = publicKey;
		PRIVATE = privateKey;
		
		PEERS = new PeerManager(this, peerBot.getRootDir());
	}

	public void start() throws IOException 
	{
		P2P = new P2PService(this, ID, new P2PServerSocket(this, ID, PORT), "P2P Service", P2PParser.class);
		PORT = P2P.getLocalPort();
	}

	public void addEventListener(String event, Callback cb)
	{
		mBot.addEventListener(event, cb);
	}

	public void stop() throws IOException 
	{
		P2P.close();
	}

	public String getLocalID() 
	{
		return ID;
	}

	public int getLocalPort() 
	{
		return PORT;
	}

	public InetAddress getInetAddress() 
	{
		return P2P.getInetAddress();
	}

	public SocketAddress getLocalSocketAddress() 
	{
		return P2P.getLocalSocketAddress();
	}

	public P2PPeer getPeer(String id) throws IOException
	{
		return PEERS.getPeer(id);
	}

	public void savePeer(P2PPeer p) throws IOException
	{
		PEERS.savePeer(p);
	}

	public void deletePeer(String id) 
	{
		PEERS.deletePeer(id);
		P2P.deletePeer(id);
	}

	public boolean hasPeer(String id) 
	{
		return PEERS.hasPeer(id);
	}

//	private P2PPeer getPeer(String id, String name, String addr, int port) throws Exception 
//	{
//		return PEERS.getPeer(id, name, addr, port);
//	}

	public boolean isLoaded(String id) 
	{
		return PEERS.isLoaded(id);
	}

	public P2PPeer connect(String uuid, String address, int port) throws Exception 
	{
		if (address != null && port != -1) 
		{
			P2PPeer p = getPeer(uuid);
			p.setAddress(address);
			p.setPort(port);
		}
		return connect(uuid);
	}

	public P2PPeer connect(String id) throws IOException 
	{
		P2PPeer p = getPeer(id);
		
		if (isTCP(id))
		{
			p.setConnected(true);
		}
		else {
			if (isUDP(id) || isRelay(id)) p.setConnected(true);
			if (p.allow(p.ALLOW_TCP)) initiateTCPConnection(p);
			if (p.allow(p.ALLOW_UDP)) initiateUDPConnection(p);
		}
		
		return p;
	}

	Hashtable<InetSocketAddress, Long> DNC = new Hashtable(); // FIXME - Probably not needed and just breaking stuff. Merge with known/seen addresses. Used by connect(p)
	protected void initiateTCPConnection(final P2PPeer p) 
	{
		int port = p.getPort();
		Vector<String> v = new Vector<>(p.getOtherAddresses());
		v.insertElementAt(p.getAddress(), 0);
		Enumeration<String> e = p.getOtherAddresses().elements();
		while (e.hasMoreElements())
		{
			final InetSocketAddress isa = new InetSocketAddress(e.nextElement(), port);
			Long l = DNC.get(isa);
			long now = System.currentTimeMillis();
			if (l == null || now - l > 30000) {
				DNC.put(isa,  now);
				mBot.addJob(new Runnable() {
					@Override
					public void run() {
						try {
							initiateTCPConnection(p, isa);
						} catch (Exception x) {
							// xxx p.removeSocketAddress(isa);
							//x.printStackTrace();
							//System.out.println("unable to establish TCP connection with " + p.getID() + " at " + isa);
						}
					}
				}, "Initiate TCP connection with " + p.getID());
			}
		}
	}

	public void disconnect(String uuid) throws IOException 
	{
		P2PParser.closeAll(uuid);
	}

	public boolean available(String uuid) 
	{
		return P2PParser.any(uuid) != null;
	}

	public void fireEvent(String event, JSONObject data) 
	{
		mBot.fireEvent(event, data);
	}

	public int strength(P2PPeer p) 
	{
		String id = p.getID();
		if (isTCP(id)) return 3;
		if (isUDP(id)) return 2;
		if (isRelay(id)) return 1;
		return 0;
	}

	public Iterator<P2PPeer> connected() 
	{
		ArrayList<P2PPeer> l = new ArrayList();
		Enumeration<String> e  = P2PParser.peers();
		while (e.hasMoreElements()) try { l.add(getPeer(e.nextElement())); } catch (Exception x) { x.printStackTrace(); }
		return l.iterator();
	}
/* xxx
	public void addInetSocketAddress(String uuid, InetSocketAddress isa) throws Exception 
	{
		P2PPeer p = getPeer(uuid);
		p.addSocketAddress(isa);
	}
*/
	public boolean isTCP(String uuid) 
	{
		return P2PParser.any(uuid, TCPSocket.class) != null;
	}

	public boolean isUDP(String uuid) 
	{
		return P2PParser.any(uuid, UDPSocket.class) != null;
	}

	public boolean isRelay(String uuid) 
	{
		return P2PParser.any(uuid, RelaySocket.class) != null;
	}

	public JSONArray relays(String uuid) 
	{
		JSONArray ja = new JSONArray();
		Enumeration<String> e = P2PParser.relays(uuid);
		while (e.hasMoreElements()) ja.put(e.nextElement());
		return ja;
	}

	public boolean getAllowAnon() {
		// TODO Auto-generated method stub
		return false;
	}

	public void setAllowAnon(boolean aa) {
		// TODO Auto-generated method stub
		
	}

	public void stream(P2PPeer p, long streamid, byte[] data) throws Exception 
	{
		System.out.println(ID+" Sending stream data "+streamid+" of length "+data.length+" to "+p.getID());

		P2PConnection s = p.getStream(streamid);
		if (s == null)
			throw new IOException("No such stream: "+streamid);
		else if (!s.isConnected())
			throw new IOException("Stream closed: "+streamid);

		byte[] ba = new byte[data.length+8];
		System.arraycopy(BotUtil.longToBytes(streamid), 0, ba, 0, 8);
		System.arraycopy(data, 0, ba, 8, data.length);
		sendBytes(Codes.STREAM, p, ba);
	}

	public void respond(P2PPeer p, long mid, JSONObject jo) throws Exception 
	{
		byte[] d2 = jo.toString().getBytes();

		byte[] d3 = new byte[d2.length+8];
		System.arraycopy(BotUtil.longToBytes(mid), 0, d3, 0, 8);
		System.arraycopy(d2, 0, d3, 8, d2.length);
		
//				System.out.println("Sending response "+mid+" of "+d2.length+" bytes to "+mID);
		sendBytes(Codes.RESPONSE, p, d3);
	}

	public void sendCommand(P2PPeer peer, P2PCommand cmd) throws Exception 
	{
		final String id = peer.getID();
		if (id.equals(getLocalID())) throw new Exception("YOU SHALL NOT CONNECT TO YOURSELF!");

		if (!peer.isConnected()) 
		{
			connect(id);
		}
		
		cmd.mID = peer.nextsendcommand++;
		peer.mCommands.put(cmd.mID, cmd);

		byte[] ba = cmd.toString().getBytes();
		byte[] data = new byte[ba.length+8];
		System.arraycopy(BotUtil.longToBytes(cmd.mID), 0, data, 0, 8);
		System.arraycopy(ba, 0, data, 8, ba.length);
		
//		peer.mLastSend = System.currentTimeMillis();
		
		sendBytes(Codes.COMMAND, peer, data);
	}

	public void sendBytes(int code, P2PPeer p, byte[] ba) throws Exception 
	{
		if (code>199) ba = p.encrypt(ba, 0, ba.length);
		
		while (true)
		{
			P2PParser best = P2PParser.best(p.getID());
			if (best == null) 
			{
				p.setConnected(false);
				break;
			}
			
			try 
			{ 
				best.send(new P2PResponse(code, ba));
				return;
			}
			catch (Exception x)
			{
				x.printStackTrace();
				best.close();
			}
		}
		
		throw new Exception("No route to host "+p.getID());
	}

	public void addJob(Runnable runnable, String name) 
	{
		mBot.addJob(runnable, name);
	}

	public void addPeriodicTask(Runnable r, long millis, String name) 
	{
		mBot.addPeriodicTask(r, millis, name, ISRUNNING);
	}

	public JSONObject connections() throws Exception
	{
		return mBot.connections();
	}

	public JSONArray knownPeers() throws Exception 
	{
		return mBot.knownPeers();
	}

	public byte[] getPublicKey(String uuid) throws IOException 
	{
		return getPeer(uuid).getPublicKey();
	}

	public byte[] getPublicKey() 
	{
		return PUBLIC;
	}

	public byte[] encryptWithPrivateKey(String uuid, byte[] ba, int off, int len) throws Exception 
	{
		return new SuperSimpleCipher(PRIVATE, getPublicKey(uuid), true).encrypt(ba, off, len);
	}

	public byte[] decryptWithPrivateKey(String uuid, byte[] ba, int off, int len) throws Exception 
	{
		return new SuperSimpleCipher(PRIVATE, getPublicKey(uuid), false).decrypt(ba, off, len);
	}

	public void setTimeout(Runnable r, String name, long millis) 
	{
		mBot.setTimeout(r, name, millis);
	}

	@Override
	public App find(String id) 
	{
		return mBot.find(id);
	}

	@Override
	public App getDefault() 
	{
		return mBot.getDefault();
	}

	@Override
	public File extractLocalFile(String path) 
	{
		return mBot.extractLocalFile(path);
	}

	@Override
	public String getMachineID() 
	{
		return mBot.getMachineID();
	}
/*
	public void sendUDP(InetSocketAddress isa, int code, byte[] ba) throws Exception 
	{
		P2P.sendUDP(isa, code, ba);
	}
*/
	public void initiateTCPConnection(P2PPeer p, InetSocketAddress isa) throws Exception 
	{
		TCPSocket tsock = new TCPSocket(isa.getHostString(), isa.getPort(), 5000);
		tsock.setSoTimeout(5000);
		P2PSocket psock = new P2PSocket(P2P, ID, PORT, tsock);
		
		P2PParser parse = new P2PParser();
		if (parse.init(P2P, psock))
		{	
			p.setConnected(true);
			tsock.setSoTimeout(60000);
			P2P.listen(psock, parse);
			
//			p.mKnownAddresses.clear();
			p.setAddress(isa.getHostString());
		}
	}
/* xxx
	public void addConfirmedAddress(String uuid, InetSocketAddress isa) throws IOException 
	{
		getPeer(uuid).addConfirmedAddress(isa);
	}
	public void confirmSocketAddress(P2PPeer peer, InetSocketAddress isa)
	{
		P2P.confirmSocketAddress(peer, isa);
	}
*/

	public JSONArray myPeers()
	{
		return mBot.myPeers();
	}

	public void initiateUDPConnection(P2PPeer p) {
		Vector<String> v = p.getOtherAddresses();
		Enumeration<String> e = v.elements();
		while (e.hasMoreElements()) try {
			String name = e.nextElement();
			if (!name.equals("127.0.0.1") && !name.equals("localhost")) {
				InetAddress addr = InetAddress.getByName(name);
				//System.out.println("Sending UDP to " + name + " for " + p.getName());
				UDPServerSocket uss = ((P2PServerSocket)P2P.getServerSocket()).UDP;
				uss.handshake(addr, p.getPort(), uss.HELO, BotUtil.uniqueSessionID());
			}
		} catch (Exception x) {
			// IGNORE
			// x.printStackTrace();
		}
	}

	public void closeAll(String id, Class claz)
	{
		Socket s;
		while ((s = P2PParser.any(id, claz)) != null) try { s.close(); } catch (Exception x) { x.printStackTrace(); }
	}
/*
	public void sendPing(InetSocketAddress isa) throws Exception
	{
		P2P.sendPing(isa);
	}
*/
}
