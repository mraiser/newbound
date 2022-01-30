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

	private static final byte HELO = 99;
	private static final byte WELCOME = 98;
	private static final byte BEGIN = 97;
	private static final byte MSG = 96;
	private static final byte RESEND = 95;
	//private static final byte ACK = 94;

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
					Thread.sleep(1000);
					Enumeration<String> e = SOCKS.keys();
					while (e.hasMoreElements()) try{
						String session = e.nextElement();
						UDPSocket sock = SOCKS.get(session);
						if (sock != null){
							long millis = System.currentTimeMillis() - sock.LASTCONTACT;
							if (sock.SOTIMEOUT != -1 && millis > sock.SOTIMEOUT){
								System.out.println("UDP Socket to "+sock.getRemoteSocketAddress()+" with session "+session+" timed out.");
								SOCKS.remove(session);
								sock.close();
							}
							else {
								sock.requestResend();
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

		if (p2p != null) {
			P2P = p2p;
			r = new Runnable() {
				@Override
				public void run() {
					while (!SOCK.isClosed()) try {
						Thread.sleep(20000);
						Enumeration<String> it = PeerManager.loaded(); //P2P.connected();
						while (it.hasMoreElements()) try {
							P2PPeer p = p2p.getPeer(it.nextElement());
							if (!p.isTCP() && !p.isUDP()) {
								Vector<String> v = p.getOtherAddresses();
								Enumeration<String> e = v.elements();
								while (e.hasMoreElements()) try {
									String name = e.nextElement();
									if (!name.equals("127.0.0.1") && !name.equals("localhost")) {
										InetAddress addr = InetAddress.getByName(name);
										//System.out.println("Sending UDP to " + name + " for " + p.getName());
										handshake(addr, p.getPort(), HELO, BotUtil.uniqueSessionID());
									}
								} catch (Exception x) {
									// IGNORE
									// x.printStackTrace();
								}
							}
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

	private void handshake(InetAddress addr, int port, byte cmd, String session) throws IOException {
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
		byte[] b = Arrays.copyOfRange(p.getData(), 0, p.getLength());
		byte cmd = b[0];
		System.out.println("Received UDP "+cmd+" from "+p.getAddress()+":"+p.getPort()+" containing "+BotUtil.toHexString(b));
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
				//sock.LASTCONTACT = System.currentTimeMillis();
				InetSocketAddress isa = sock.getRemoteSocketAddress();
				int off = 2 + len1;
				int msgid = BotUtil.bytesToInt(b, off);
				//System.out.println("RECEIVED RESEND REQUEST: "+msgid+"/"+s);
				byte[] ba = sock.getSentMsg(msgid);
				if (ba != null) send(s, msgid, ba, isa.getAddress(), isa.getPort());
				else System.out.println("Message ID not found: "+msgid+"/"+s);
			}
			else System.out.println("UDP Session ID not found: "+s);
		}
/*
		else if (cmd == ACK){ // FIXME - Should not happen, we always ask for resend instead
			int len1 = (int)b[1] & 0xff;
			String s = new String(b, 2, len1);
			UDPSocket sock = SOCKS.get(s);
			if (sock != null) {
				sock.LASTCONTACT = System.currentTimeMillis();
				int off = 2 + len1;
				int msgid = BotUtil.bytesToInt(b, off);
				System.out.println("RECEIVED ACK: "+msgid+"/"+s);
				sock.ack(msgid);
			}
		}
*/
		else if (cmd == HELO || cmd == WELCOME || cmd == BEGIN) {
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
			}
		}
		else {
			System.out.println("UNKNOWN UDP COMMAND: "+cmd+"/"+BotUtil.toHexString(b)+"/"+new String(b));
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
