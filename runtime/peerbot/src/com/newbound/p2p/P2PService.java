package com.newbound.p2p;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Vector;

import javax.crypto.BadPaddingException;

import com.newbound.net.service.*;
import org.json.JSONObject;

import com.newbound.crypto.SuperSimpleCipher;
import com.newbound.net.tcp.TCPSocket;
import com.newbound.p2p.protocol.COMMAND;
import com.newbound.p2p.protocol.KEEPALIVE;
import com.newbound.p2p.protocol.NORELAY;
import com.newbound.p2p.protocol.PUBKEY;
import com.newbound.p2p.protocol.READKEY;
import com.newbound.p2p.protocol.RELAY;
import com.newbound.p2p.protocol.RELAYED;
import com.newbound.p2p.protocol.RESPONSE;
import com.newbound.p2p.protocol.SEND_PUBKEY;
import com.newbound.p2p.protocol.SEND_READKEY;
import com.newbound.p2p.protocol.STREAM;
import com.newbound.p2p.protocol.STREAM_DIED;
import com.newbound.robot.Callback;
import com.newbound.util.IsRunning;

public class P2PService extends Service 
{
	String UUID;
	P2PManager P2P;

	class SyncListener{
		P2PSocket s;
		Parser p;
		boolean listening = false;

		SyncListener(Socket sock, Parser parser){
			s = (P2PSocket)sock;
			p = parser;
		}

		public boolean available() throws IOException {
			return (s.SOCK == null ? false : RUNNING && s.isConnected() && !s.isClosed() && s.SOCK.getInputStream().available()>0);
		}

		public void listen(){
			try
			{
				Request jo2 = p.parse();
				Object cmd = jo2.getCommand();
				execute(cmd, jo2, p);
			}
			catch (SocketTimeoutException | SocketClosedException | SocketException x) // Requires Java 7+
			{
				LISTENERS.remove(this);
				try { p.close(); } catch (Exception xx) { xx.printStackTrace(); }
				try { s.close(); } catch (Exception xx) { xx.printStackTrace(); }
			}
			catch (ReleaseSocketException x)
			{
				LISTENERS.remove(this);
			}
			catch (Exception x)
			{
				p.error(x);
			}
		}
	}
	Vector<SyncListener> LISTENERS = new Vector<>();

	public P2PService(P2PManager p2p, String uuid, ServerSocket ss, String name, Class parser) throws IOException 
	{
		super(ss, name, parser, p2p);
		
		UUID = uuid;
		P2P = p2p;
		
		on(Codes.RELAY, new RELAY(this));
		on(Codes.RELAYED, new RELAYED(this));
		on(Codes.NORELAY, new NORELAY(this));
		
		on(Codes.STREAM, new STREAM(this));
		on(Codes.COMMAND, new COMMAND(this));
		on(Codes.RESPONSE, new RESPONSE(this));
		on(Codes.STREAM_DIED, new STREAM_DIED(this));
		
		on(Codes.SEND_PUBKEY, new SEND_PUBKEY(this));
		on(Codes.PUBKEY, new PUBKEY(this));
		on(Codes.SEND_READKEY, new SEND_READKEY(this));
		on(Codes.READKEY, new READKEY(this));
		
		on(Codes.KEEPALIVE, new KEEPALIVE(this));

		p2p.addJob(new Runnable() {
			@Override
			public void run() {
				while (!RUNNING) try { Thread.sleep(500); } catch (Exception x) { x.printStackTrace(); }
				while (RUNNING){
					int i = LISTENERS.size();
					int n = 0;
					while (i-->0) try{
						final SyncListener listen = LISTENERS.elementAt(i);
						if (listen.available() && !listen.listening) { // FIXME - Should probably sync on a mutex when checking/changing "listen.listening" but maybe not since only one thread is checking/changing/listening
							listen.listening = true;
							n++;
							p2p.addJob(new Runnable() {
								@Override
								public void run() {
									listen.listening = true;
									try {
										while (listen.available()) listen.listen();
									}
									catch (Exception x) { x.printStackTrace(); }
									finally { listen.listening = false; }
								}
							}, "Parsing synchronous P2P socket");
						}
					}
					catch (Exception x) { x.printStackTrace(); }
					try { if (n == 0) Thread.sleep(100);} catch (Exception x) { x.printStackTrace(); }
				}
			}
		}, "Listening to synchronous P2P sockets");
	}

	@Override
	public void listen(Socket s, Parser p) throws Exception
	{
		if (((P2PSocket)s).SOCK instanceof TCPSocket) super.listen(s, p);
		else LISTENERS.addElement(new SyncListener(s, p));
	}

	@Override
	protected void execute(Object cmd, Request data, Parser parser) throws Exception 
	{
		super.execute(cmd, data, parser);
	}


	public boolean sendTCP(String uuid, byte[] ba, int code) throws Exception 
	{
		while (true) try
		{
			P2PSocket sock = P2PParser.any(uuid, TCPSocket.class);
			if (sock == null) break; 
			boolean b = send(sock, ba, code);
			if (!b) sock.close();
			else return true;
		}
		catch (Exception x) { x.printStackTrace(); }
		
		return false;
	}

	private boolean send(P2PSocket sock, byte[] ba, int code) throws Exception 
	{
		P2PResponse res = new P2PResponse(code, ba);
		sock.send(res);
		return true;
	}


	public RelaySocket getRelay(String uuid, String relay) throws IOException 
	{
		return ((P2PServerSocket)SS).addRelay(uuid, relay);
	}


	public void removeRelay(String target, String relay) throws IOException 
	{
		((P2PServerSocket)SS).removeRelay(target, relay);
	}


	public P2PPeer getPeer(String uuid) throws IOException 
	{
		return P2P.getPeer(uuid);
	}


	public boolean isOK(String uuid, P2PSocket sock, final Callback cb, final JSONObject data)	{
		if (uuid != null) try {
			P2PPeer p = P2P.getPeer(uuid);
			if (p != null) 
			{
				if (p.getPublicKey() != null && p.getReadKey() != null)
				{
					sock.CONNECTING = false;
					return true;
				}

				if (!sock.CONNECTING)
				{
					if (p.getPublicKey() == null)
					{
						sock.CONNECTING = true;
						sock.PARSER.send(new P2PResponse(Codes.SEND_PUBKEY, "".getBytes()));
					}
					else if (p.getReadKey() == null)
					{
						sock.CONNECTING = true;
						sock.PARSER.send(new P2PResponse(Codes.SEND_READKEY, "".getBytes()));
					}
					else {
						return true;
					}
				}
			}
		}
		catch (Exception x) { x.printStackTrace(); }
		
		if (cb != null) 
		{
			P2P.setTimeout(new Runnable() 
			{
				@Override
				public void run() 
				{
					cb.execute(data);
				}
			}, "P2PSocket connecting, waiting to execute command", 100);
			
			System.out.println("P2PSocket connecting, waiting to execute command");
		}
		
		return false;
	}


	public byte[] getPublicKey() 
	{
		return P2P.getPublicKey();
	}


	public boolean send(String uuid, byte[] ba, int code) throws Exception 
	{
		while (true) try
		{
			P2PParser sock = P2PParser.best(uuid);
			if (sock == null) break; 
			boolean b = send(sock.SOCK, ba, code);
			if (!b) sock.close();
			else return true;
		}
		catch (Exception x) { x.printStackTrace(); }
		
		return false;
	}


	public void addJob(Runnable runnable, String name) 
	{
		P2P.addJob(runnable, name);
	}

	public byte[] encryptWithPrivateKey(String uuid, byte[] ba, int off, int len) throws Exception 
	{
		return P2P.encryptWithPrivateKey(uuid, ba, off, len);
	}

	public byte[] decryptWithPrivateKey(String uuid, byte[] ba, int off, int len) throws Exception 
	{
		return P2P.decryptWithPrivateKey(uuid, ba, off, len);
	}


	public void setTimeout(Runnable runnable, String name, long millis) 
	{
		P2P.setTimeout(runnable, name, millis);
	}

	public InetAddress getInetAddress() 
	{
		return SS.getInetAddress();
	}

	public int getLocalPort() 
	{
		return SS.getLocalPort();
	}


	public void deletePeer(String id) 
	{
		P2PParser.remove(id);
	}

/*
	public void sendUDP(InetSocketAddress isa, int code, byte[] ba) throws Exception 
	{
		((P2PServerSocket)SS).sendUDP(isa, code, ba);
	}
*/

	public String getLocalID() 
	{
		return P2P.getLocalID();
	}
/* xxx
	public void addConfirmedAddress(String uuid, InetSocketAddress isa) throws IOException 
	{
		P2P.addConfirmedAddress(uuid, isa);
	}

    public void confirmSocketAddress(P2PPeer peer, InetSocketAddress isa)
	{
		((P2PServerSocket)SS).CHECKING.addElement(new Object[] { peer, isa });
    }

	public void sendPing(InetSocketAddress isa) throws Exception
	{
		((P2PServerSocket)SS).sendPing(isa);
	}


	public void sendPong(InetSocketAddress isa) throws Exception 
	{
		((P2PServerSocket)SS).sendPong(isa);
	}
*/
}