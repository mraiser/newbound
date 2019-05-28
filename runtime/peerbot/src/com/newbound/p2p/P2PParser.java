package com.newbound.p2p;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Vector;

import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.net.service.Parser;
import com.newbound.net.service.Request;
import com.newbound.net.service.Response;
import com.newbound.net.service.Service;
import com.newbound.net.service.Socket;
import com.newbound.net.tcp.TCPSocket;
import com.newbound.net.udp.UDPSocket;
import com.newbound.robot.BotUtil;
import com.newbound.robot.Callback;

public class P2PParser implements Parser 
{
	private static final Hashtable<String, Vector<P2PSocket>> ALLSOCKS = new Hashtable();
	
	P2PService PS;
	P2PSocket SOCK;
	InputStream IN;
	OutputStream OUT;
	
	public String REMOTEID;
	public int REMOTEPORT;
	
	public P2PParser()
	{
		super();
	}
	
	@Override
	public boolean init(Service service, Socket sock) throws Exception 
	{
		PS = (P2PService)service;
		SOCK = (P2PSocket)sock;
		IN = sock.getInputStream();
		OUT = sock.getOutputStream();
		
		SOCK.PARSER = this;
		
		OutputStream os = sock.getOutputStream();
		if (SOCK.SOCK instanceof TCPSocket)
		{
			os.write(SOCK.LOCALID.getBytes());
			os.write(BotUtil.intToBytes(SOCK.PORT));
			os.flush();
		
			int len = 40;
			ByteArrayOutputStream baos = new ByteArrayOutputStream(len);
			long l = BotUtil.sendData(sock.getInputStream(), baos, len, len);
			if (l != len) 
				throw new Exception("Incoming P2P Connection died abruptly");
			byte[] buf = baos.toByteArray();
			REMOTEID = new String(buf, 0, 36);
			REMOTEPORT = BotUtil.bytesToInt(buf, 36);
		}
		else if (SOCK.SOCK instanceof RelaySocket)
		{
			RelaySocket rs = (RelaySocket)SOCK.SOCK;
			REMOTEID = rs.TARGETID;
			REMOTEPORT = PS.getPeer(REMOTEID).getPort();
		}
		else
		{
			System.out.println("bb");
		}

		System.out.println("P2P connect "+REMOTEID);
		
		Vector<P2PSocket> v = ALLSOCKS.get(REMOTEID);
		if (v == null) ALLSOCKS.put(REMOTEID, v = new Vector());
		v.addElement(SOCK);

		SOCK.P2P.isOK(REMOTEID, SOCK, null, null);

		return true;
	}

	@Override
	public P2PRequest parse() throws Exception 
	{
		byte[] ba = new byte[4];
		
		for (int i=0;i<4;i++) { ba[i] = (byte)IN.read(); if (ba[i] == -1) { SOCK.close(); throw new Exception("Connection died (1)"); }}
		int code = BotUtil.bytesToInt(ba, 0);
		
		for (int i=0;i<4;i++) { ba[i] = (byte)IN.read(); if (ba[i] == -1) { SOCK.close(); throw new Exception("Connection died (2)"); }}
		int len = BotUtil.bytesToInt(ba, 0);
		
		if (len<0 || len > 50000)
			System.out.println("Probably bad data "+len+" bytes");

//		System.out.println("Parsing P2P request of length "+len);
		ByteArrayOutputStream baos = new ByteArrayOutputStream(len);
		long l = BotUtil.sendData(IN, baos, len, len);
		if (l != len) 
		{ 
		
// Caused by InputStream that doesn't support available()

//			len -= l;
//			l = BotUtil.sendData(IN, baos, len, len);
//			if (l != len)
//			{
				SOCK.close(); 
				throw new Exception("InputStream doesn't support available. Connection closed (3)"); 
//			}
		}
		ba = baos.toByteArray();
		
		return new P2PRequest(SOCK, REMOTEID, code, ba); 
	}

	@Override
	public void send(Response response) throws IOException 
	{
		boolean b = SOCK.SOCK instanceof RelaySocket;
		RelaySocket rs = b ? (RelaySocket)SOCK.SOCK : null;
		
		synchronized (SOCK.SEND_MUTEX)
		{
			P2PResponse r = (P2PResponse)response;
			int code = r.getCode();
			byte[] ba = r.getBytes();
			int off = 0;
			int len = ba.length;
			if (b) OUT.write(rs.TARGETID.getBytes());
			OUT.write(BotUtil.intToBytes(code));
			if (!b) OUT.write(BotUtil.intToBytes(len));
			OUT.write(ba, off, len);
			OUT.flush();
		}
	}

	@Override
	public void error(Exception x) 
	{
		System.err.println("P2P REQUEST ERROR: "+x+x.getMessage());
	}

	@Override
	public void execute(Request req, Callback cb) throws Exception 
	{
		JSONObject data = ((P2PRequest)req).toJSON();
		data.put("p2psocket", SOCK);
		cb.execute(data);
	}
	
	public static P2PSocket any(String uuid) 
	{
		Vector<P2PSocket> v = ALLSOCKS.get(uuid);
		return v == null || v.size() == 0 ? null : v.elementAt(0);
	}

	public static Enumeration<P2PSocket> all(String uuid) 
	{
		Vector<P2PSocket> hash = ALLSOCKS.get(uuid);
		return hash == null ? new Vector<P2PSocket>().elements() : hash.elements();
	}

	public static Enumeration<String> peers() 
	{
		return ALLSOCKS.keys();
	}

	public static P2PSocket any(String uuid, Class claz) 
	{
		Vector<P2PSocket> v = ALLSOCKS.get(uuid);
		if (v == null || v.size() == 0) return null;
		for (int i=0; i<v.size(); i++)
		{
			P2PSocket s = v.elementAt(i);
			if (s.SOCK.getClass().equals(claz)) 
				return s;
		}
		return null;
	}

	public static void closeAll(String uuid) throws IOException 
	{
		Vector<P2PSocket> socks = ALLSOCKS.get(uuid);
		while (socks.size()>0) socks.elementAt(0).close();
	}

	@Override
	public void close()
	{
		ALLSOCKS.get(REMOTEID).remove(SOCK);
		if (SOCK != null) try 
		{ 
			P2PSocket s = SOCK;
			SOCK = null;
			s.close(); 
		} 
		catch (Exception x) { x.printStackTrace(); }
	}

	public static P2PParser best(String id) 
	{
		P2PSocket sock = any(id, TCPSocket.class);
		if (sock == null) sock = any(id, UDPSocket.class);
		if (sock == null) sock = any(id, RelaySocket.class);
		return sock == null ? null : sock.PARSER;
	}

	public static Enumeration<String> relays(String uuid) 
	{
		Vector<String> v = new Vector();
		Enumeration<P2PSocket> e = all(uuid);
		while (e.hasMoreElements())
		{
			P2PSocket s = e.nextElement();
			if (s.SOCK.getClass().equals(RelaySocket.class)) {
				RelaySocket rs = (RelaySocket)s.SOCK;
				v.addElement(rs.RELAYID);
			}
		}
		
		return v.elements();
	}

	public RelaySocket relay(String relay, String target) throws Exception
	{
		Vector<String> v = new Vector();
		Enumeration<P2PSocket> e = all(target);
		while (e.hasMoreElements())
		{
			P2PSocket s = e.nextElement();
			if (s.SOCK.getClass().equals(RelaySocket.class)) {
				RelaySocket rs = (RelaySocket)s.SOCK;
				if (rs.RELAYID.equals(relay)) return rs;
			}
		}
		
		RelaySocket rs = new RelaySocket(relay, target);
		if (init(PS, rs)) PS.listen(rs, this);
		return rs;
	}

	public static void remove(String id) 
	{
		Vector<P2PSocket> socks = ALLSOCKS.remove(id);
		if (socks != null)
		{
			int i = socks.size();
			while (i-->0) try { socks.remove(0).close(); } catch (Exception x) { x.printStackTrace(); }
		}
	}

	public static void maintenance() 
	{
		Enumeration<String> e1 = ALLSOCKS.keys();
		while (e1.hasMoreElements())
		{
			String peer = e1.nextElement();
			Vector<P2PSocket> v = ALLSOCKS.get(peer);
			int i = v.size();
			while (i-->0) try
			{
				P2PSocket sock = v.elementAt(i);
//				byte[] ba = {};
//				sock.send(new P2PResponse(Codes.KEEPALIVE, ba));
				if (sock.isClosed()) v.remove(i);
			}
			catch (Exception x) 
			{
				P2PSocket sock = v.remove(i);
				x.printStackTrace(); 
				sock.close();
			}
		}
	}
}
