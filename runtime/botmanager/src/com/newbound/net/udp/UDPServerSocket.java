package com.newbound.net.udp;

import com.newbound.net.service.ServerSocket;
import com.newbound.net.service.Socket;
import com.newbound.p2p.P2PManager;
import com.newbound.p2p.P2PPeer;
import com.newbound.p2p.PeerManager;
import com.newbound.robot.BotUtil;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.*;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Vector;

public class UDPServerSocket implements ServerSocket
{
	protected int PORT;
	protected DatagramSocket SOCK;
	protected int BUFLEN = 65535;

	private Vector<UDPSocket> INCOMING = new Vector();
	private Object MUTEX = new Object();
	private P2PManager P2P = null;
	private Hashtable<String, UDPSocket> SOCKS = new Hashtable<>();

	public static final byte HELO = 99;
	public static final byte WELCOME = 98;
	public static final byte BEGIN = 97;
	public static final byte MSG = 96;
	public static final byte RESEND = 95;
	private static final byte TEST = 94;
	private static final byte TESTOK = 93;

	public UDPServerSocket(P2PManager p2p, int port) throws SocketException {
		PORT = port;
		SOCK = new DatagramSocket(port);

		Runnable r = new Runnable()
		{
			public void run()
			{
				byte[] buf = new byte[BUFLEN];

				while (!SOCK.isClosed())
				{
					try
					{
						DatagramPacket p = new DatagramPacket(buf, BUFLEN);
						SOCK.receive(p);
						route(p);
					}
					catch (Exception x)
					{
						x.printStackTrace();
					}
				}
			}
		};
		new Thread(r).start();

		r = new Runnable() {
			@Override
			public void run() {
				while (!SOCK.isClosed()) try {
					Thread.sleep(500);
					int n = 0;
					Enumeration<String> e = SOCKS.keys();
					while (e.hasMoreElements()) try{
						String session = e.nextElement();
						UDPSocket sock = SOCKS.get(session);
						if (sock != null){
							long now = System.currentTimeMillis();
							long millis = now - sock.LASTCONTACT;
							if (sock.isClosed() || (sock.SOTIMEOUT != -1 && millis > sock.SOTIMEOUT)){
								System.out.println("UDP Socket to "+sock.getRemoteSocketAddress()+" with session "+session+" timed out.");
								SOCKS.remove(session);
								sock.close();
							}
							else {
								if (sock.needsResend() || (millis > 1000 && now - sock.LASTRESEND > 1000)) {
									//System.out.println("Requesting resend "+session);
									sock.requestResend(); // FIXME - also/instead resend first in sent list?
								}
							}
						}
					}
					catch (Exception x)
					{
						x.printStackTrace();
					}
				}
				catch (Exception x)
				{
					x.printStackTrace();
				}
			}
		};
		new Thread(r).start();

		if (p2p != null) { // FIXME - Move to P2PServerSocket.maintenance()
			P2P = p2p;
			r = new Runnable() {
				@Override
				public void run() {
					while (!SOCK.isClosed()) try {
						Thread.sleep(20000);
						Enumeration<String> it = PeerManager.loaded(); //P2P.connected();
						while (it.hasMoreElements()) try {
							P2PPeer p = p2p.getPeer(it.nextElement());
							if (!p.isTCP() && p.allow(p.ALLOW_UDP) && !p.isUDP()) p2p.initiateUDPConnection(p);
						} catch (Exception x) {
							x.printStackTrace();
						}
					} catch (Exception x) {
						x.printStackTrace();
					}
				}
			};
			new Thread(r).start();
		}
	}

	public void testSize(int size, InetAddress addr, int port, String session) throws IOException {
		ByteArrayOutputStream baos = new ByteArrayOutputStream();
		baos.write(TEST);
		baos.write(BotUtil.intToBytes(session.length()));
		baos.write(session.getBytes());
		baos.write(BotUtil.intToBytes(size));
		baos.write(new byte[size]);
		baos.close();
		byte[] buf = baos.toByteArray();
		System.out.println("TEST: "+size+" to "+addr+":"+port+" VIA UDP session: "+session);
		DatagramPacket dp = new DatagramPacket(buf, buf.length, addr, port);
		SOCK.send(dp);
	}

	public void testSizeOK(int size, InetAddress addr, int port, String session) throws IOException {
		ByteArrayOutputStream baos = new ByteArrayOutputStream();
		baos.write(TESTOK);
		baos.write(BotUtil.intToBytes(session.length()));
		baos.write(session.getBytes());
		baos.write(BotUtil.intToBytes(size));
		baos.close();
		byte[] buf = baos.toByteArray();
		System.out.println("TEST SIZE OK: "+size+" to "+addr+":"+port+" VIA UDP session: "+session);
		DatagramPacket dp = new DatagramPacket(buf, buf.length, addr, port);
		SOCK.send(dp);
	}

	public void handshake(InetAddress addr, int port, byte cmd, String session) throws IOException {
		ByteArrayOutputStream baos = new ByteArrayOutputStream();
		baos.write(cmd);
		baos.write(session.getBytes());
		baos.close();
		byte[] buf = baos.toByteArray();
		System.out.println("HANDSHAKE: "+cmd+" to "+addr+":"+port+" VIA UDP: "+BotUtil.toHexString(buf));
		DatagramPacket dp = new DatagramPacket(buf, buf.length, addr, port);
		SOCK.send(dp);
	}

	public void send(String session, int msgid, byte[] ba, InetAddress addr, int port) throws IOException {
		ByteArrayOutputStream baos = new ByteArrayOutputStream();
		baos.write(MSG);
		baos.write(session.length());
		baos.write(session.getBytes());
		baos.write(BotUtil.intToBytes(msgid));
		baos.write(BotUtil.intToBytes(ba.length));
		baos.write(ba);
		baos.close();
		byte[] buf = baos.toByteArray();
		DatagramPacket dp = new DatagramPacket(buf, buf.length, addr, port);
		SOCK.send(dp);
	}

	public void requestResend(String session, int msgid, InetAddress addr, int port) throws IOException {
		//System.out.println("Requesting RESEND of message "+msgid+" for "+session);
		sendInt(session, RESEND, msgid, addr, port);
	}
/*
	public void sendACK(String session, int msgid, InetAddress addr, int port) throws IOException {
		sendInt(session, ACK, msgid, addr, port);
	}
*/
	public void sendInt(String session, byte cmd, int i, InetAddress addr, int port) throws IOException {
		ByteArrayOutputStream baos = new ByteArrayOutputStream();
		baos.write(cmd);
		baos.write(session.length());
		baos.write(session.getBytes());
		baos.write(BotUtil.intToBytes(i));
		baos.close();
		byte[] buf = baos.toByteArray();
		DatagramPacket dp = new DatagramPacket(buf, buf.length, addr, port);
		SOCK.send(dp);
	}

	protected void route(DatagramPacket p) throws IOException {
		byte[] b = p.getData();
		byte cmd = b[0];
		//System.out.println("Received UDP "+cmd+" from "+p.getAddress()+":"+p.getPort()+" containing "+BotUtil.toHexString(b));
		if (cmd == MSG){
			int len1 = (int)b[1] & 0xff;
			String s = new String(b, 2, len1);
			UDPSocket sock = SOCKS.get(s);
			if (sock != null) {
				int off = 2 + len1;
				int msgid = BotUtil.bytesToInt(b, off);
				off += 4;
				int len2 = BotUtil.bytesToInt(b, off);
				off += 4;
				// FIXME - Check if off + len2 < p.getLength()
				sock.incoming(msgid, b, off, len2);
			}
		}
		else if (cmd == RESEND){
			int len1 = (int)b[1] & 0xff;
			String s = new String(b, 2, len1);
			UDPSocket sock = SOCKS.get(s);
			if (sock != null) {
				sock.LASTCONTACT = System.currentTimeMillis();
				InetSocketAddress isa = sock.getRemoteSocketAddress();
				int off = 2 + len1;
				int msgid = BotUtil.bytesToInt(b, off);
				//System.out.println("RECEIVED RESEND REQUEST: "+msgid+"/"+s);
				sock.resend(msgid);
			}
			else System.out.println("UDP Session ID not found: "+s);
		}
		else if (cmd == HELO || cmd == WELCOME || cmd == BEGIN) { // FIXME - add encrypted challenge
			String s = new String(b, 1, p.getLength()-1); // FIXME - Do sanity check on length
			UDPSocket sock = new UDPSocket(this, s, p.getAddress(), p.getPort());

			if (cmd == HELO) handshake(p.getAddress(), p.getPort(), WELCOME, s);
			else {
				synchronized (MUTEX) {
					SOCKS.put(s, sock);
					INCOMING.addElement(sock);
					MUTEX.notify();
				}
				if (cmd == WELCOME) handshake(p.getAddress(), p.getPort(), BEGIN, s);
				testSize(2000, p.getAddress(), p.getPort(), s);
				testSize(5000, p.getAddress(), p.getPort(), s);
				testSize(10000, p.getAddress(), p.getPort(), s);
				testSize(20000, p.getAddress(), p.getPort(), s);
				testSize(50000, p.getAddress(), p.getPort(), s);
			}
		}
		else if (cmd == TEST){
			int len1 = BotUtil.bytesToInt(b, 1);
			String s = new String(b, 5, len1);
			int off = 5 + len1;
			int len2 = BotUtil.bytesToInt(b, off);
			off += 4;
			if (off + len2 == p.getLength()) { // FIXME - MTU is actually 1 byte more than tested
				testSizeOK(len2, p.getAddress(), p.getPort(), s);
			}
		}
		else if (cmd == TESTOK){
			int len1 = BotUtil.bytesToInt(b, 1);
			String s = new String(b, 5, len1);
			int off = 5 + len1;
			int len2 = BotUtil.bytesToInt(b, off);
			UDPSocket sock = SOCKS.get(s);
			if (sock != null && sock.MTU < len2) {
				sock.MTU = len2;
				System.out.println("New MTU for "+s+" is "+len2);
			}
		}
		else {
			System.out.println("UNKNOWN UDP COMMAND: "+cmd+" from "+p.getAddress()+"/"+p.getPort());
		}
	}

	@Override
	public Socket accept() throws IOException {
		synchronized (MUTEX)
		{
			if (INCOMING.isEmpty()) try { MUTEX.wait(); } catch (Exception x) {}
			return INCOMING.remove(0);
		}
	}

	@Override
	public SocketAddress getLocalSocketAddress() {
		return SOCK.getLocalSocketAddress();
	}

	@Override
	public InetAddress getInetAddress() {
		return SOCK.getLocalAddress(); // FIXME - Is this correct?
	}

	@Override
	public int getLocalPort() {
		return PORT;
	}

	@Override
	public void close() throws IOException {
		SOCK.close();
	}

	public Socket connect(InetSocketAddress isa) throws IOException {
		handshake(isa.getAddress(), isa.getPort(), HELO, BotUtil.uniqueSessionID());
		return accept();
	}
}
