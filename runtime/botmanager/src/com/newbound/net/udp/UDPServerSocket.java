package com.newbound.net.udp;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.net.SocketException;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Vector;

import com.newbound.net.service.ServerSocket;
import com.newbound.robot.BotUtil;

public class UDPServerSocket implements ServerSocket
{
	private static final int MAXLAG = 10;
	private static final Vector<UDPMessage> SENT = new Vector();
	private static final Hashtable<Integer, UDPServerSocket> SERVS = new Hashtable();

	private Hashtable<Integer, UDPSocket> SOCKS = new Hashtable();
	private Vector<UDPSocket> INCOMING = new Vector();
	private Object MUTEX = new Object();
	
	protected int BUFLEN = 65535;
	protected int PORT;
	protected DatagramSocket SOCK;
	
	public UDPServerSocket() throws SocketException
	{
		this(new DatagramSocket());
	}
	
	public UDPServerSocket(int port) throws SocketException
	{
		this(new DatagramSocket(port));
	}
	
	private UDPServerSocket(DatagramSocket sock) throws SocketException
	{
		PORT = sock.getLocalPort();
		
		synchronized(SERVS)
		{
			if (SERVS.get(PORT) != null) throw new SocketException("There is already a UDP service bound to that port.");
			SOCK = sock;
			SERVS.put(PORT, this);
		}
		
		Runnable r = new Runnable() 
		{
			public void run() 
			{
				byte[] buf = new byte[BUFLEN];
				DatagramPacket p = new DatagramPacket(buf, BUFLEN);

				while (!SOCK.isClosed())
				{
					try
					{
						SOCK.receive(p);
						route(p);
					}
					catch (Exception x)
					{
						x.printStackTrace();
					}
				}
				
				SERVS.remove(PORT);
			}
		};
		
		new Thread(r).start();
	}

	public static UDPServerSocket any() throws SocketException 
	{
		synchronized(SERVS)
		{
			Enumeration<UDPServerSocket> e = SERVS.elements();
			if (e.hasMoreElements()) return e.nextElement();
			
			return new UDPServerSocket();
		}
	}

	public static UDPServerSocket get(int port) throws SocketException 
	{
		synchronized(SERVS)
		{
			UDPServerSocket uss = SERVS.get(port);
			if (uss != null) return uss;
			return new UDPServerSocket(port);
		}
	}
	
	protected void connect(UDPSocket sock) throws Exception
	{
		long l = System.currentTimeMillis();
		SOCKS.put(sock.getLocalID(), sock);

		UDPMessage m = new UDPMessage(sock, UDPMessage.CONNECT, 0l, new byte[0]);
		send(m, true);

		ByteArrayOutputStream baos = new ByteArrayOutputStream(5);
		BotUtil.sendData(sock.getInputStream(), baos, 5, 5);
		baos.close();
		String hello = new String(baos.toByteArray());
		
		if (!hello.equals("hello")) {
			l = System.currentTimeMillis() - l;
			throw new Exception("Unable to establish connection with "+sock.getRemoteAddr()+" after "+l+"ms");
		}
	}

	protected void send(UDPMessage m, boolean skip) throws IOException 
	{
		synchronized (SENT)
		{
			if (!skip && m.getType() == UDPMessage.DATA && SENT.size() >= MAXLAG) try { SENT.wait(); } catch (Exception x) {}
			
			byte[] buf = m.toBytes();
			DatagramPacket dp = new DatagramPacket(buf, buf.length, InetAddress.getByName(m.getRemoteAddress()), m.getRemotePort());
			SOCK.send(dp);
			
			if (!skip && m.getType() == UDPMessage.DATA) SENT.addElement(m);
		}
	}

	protected synchronized void route(DatagramPacket p) throws IOException
	{
		UDPMessage m = new UDPMessage(p, PORT);

		if (m.getType() == UDPMessage.CONNECT) newSock(m);
		else if (m.getType() == UDPMessage.ACK) remove(m.getID());
		else if (m.getType() == UDPMessage.RESEND) resend(m.getID());
		else if (m.getType() == UDPMessage.PING) System.out.println("PING "+m);
		else if (m.getType() == UDPMessage.DATA)
		{
			UDPSocket sock = getSock(m.getLocalSocketID());
			if (sock == null) 
				System.out.println("Unsolicited packet from "+p.getSocketAddress());
			else sock.incoming(m);
		}
		else 
			System.out.println("Receieved packet of unknown type from "+p.getSocketAddress());
	}

	private void resend(long id) throws IOException 
	{
		int i = 0;
		int n = SENT.size();
		for (i=0; i<n; i++)
		{
			UDPMessage m = SENT.elementAt(i);
			if (m.getID() == id) send(m, true);
		}
	}

	private void remove(long id) 
	{
		synchronized (SENT)
		{
			while (SENT.size()>0 && SENT.elementAt(0).getID()<=id) SENT.removeElementAt(0);
			SENT.notify();
		}
	}

	private UDPSocket getSock(int sockid) 
	{
		return SOCKS.get(sockid);
	}

	private void newSock(UDPMessage m) throws IOException 
	{
		synchronized (MUTEX)
		{
			UDPSocket sock = new UDPSocket(m);
			SOCKS.put(sock.getLocalID(), sock);
			INCOMING.addElement(sock);
			
			OutputStream os = sock.getOutputStream();
			os.write("hello".getBytes());
			os.flush();
			
			INCOMING.notify();
		}
	}

	public int getPort() 
	{
		return PORT;
	}
	
	public UDPSocket accept()
	{
		synchronized (MUTEX)
		{
			if (INCOMING.isEmpty()) try { MUTEX.wait(); } catch (Exception x) {}
			return INCOMING.remove(0);
		}
	}

	public void close()
	{
		SOCK.close();
		synchronized (MUTEX) { MUTEX.notifyAll(); }
	}
	
	public static void main(String[] args) throws Exception
	{
		UDPServerSocket USS1 = new UDPServerSocket();
		UDPServerSocket USS2 = new UDPServerSocket();
		
		UDPSocket sock1 = new UDPSocket(USS1.getPort(), "localhost", USS2.getPort());
		UDPSocket sock2 = USS2.accept();
		
		OutputStream os = sock1.getOutputStream();
		os.write("HELLO WORLD".getBytes());
		os.flush();
		byte[] buf = new byte[11];
		sock2.getInputStream().read(buf);
		System.out.println(new String(buf));
		
		USS1.close();
		USS2.close();
	}

	protected void close(UDPSocket sock) 
	{
		if (SOCKS.get(sock.getRemotePort()) == sock) SOCKS.remove(sock.getRemotePort());
	}

	public void sendBytes(InetSocketAddress isa, int code, byte[] ba) throws Exception 
	{
		int off = 0;
		int len = ba.length;
		ByteArrayOutputStream OUT = new ByteArrayOutputStream();
		OUT.write(BotUtil.intToBytes(code));
		OUT.write(BotUtil.intToBytes(len));
		OUT.write(ba, off, len);
		OUT.flush();
		OUT.close();
		ba = OUT.toByteArray();
		
		UDPMessage m = new UDPMessage(SOCK.getLocalPort(), isa, 0, 0, UDPMessage.DATA, 0, ba);
		byte[] buf = m.toBytes();
		DatagramPacket dp = new DatagramPacket(buf, buf.length, InetAddress.getByName(m.getRemoteAddress()), m.getRemotePort());
		SOCK.send(dp);
	}

	@Override
	public SocketAddress getLocalSocketAddress() 
	{
		return SOCK.getLocalSocketAddress();
	}

	@Override
	public InetAddress getInetAddress() 
	{
		return SOCK.getLocalAddress();
	}

	@Override
	public int getLocalPort() 
	{
		return getLocalPort();
	}


}
