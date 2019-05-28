package com.newbound.net.udp;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.net.SocketException;
import java.util.Hashtable;
import java.util.Vector;

import com.newbound.net.service.Socket;

public class UDPSocket implements Socket
{
	private int MAXDROP = 3;
	
	private int LOCALPORT;
	private int REMOTEPORT;
	private String REMOTEADDR;
	private int LOCALSOCKID;
	private int REMOTESOCKID;
	
	private Vector<byte[]> DATA = new Vector();
	private Hashtable<Long, UDPMessage> HOLD = new Hashtable();
	
	private long LOCALNEXTID = 0; 
	private long REMOTENEXTID = 0; 
	
	private byte[] CURRENT = null;
	private int OFFSET = 0;
	
	private boolean CONNECTED = true;
	private boolean CLOSED = false;
	
	private int SOTIMEOUT = 10000;
	
	private InputStream INPUTSTREAM = new InputStream() 
	{
		@Override
		public int read() throws IOException 
		{
			synchronized (DATA)
			{
				if (CURRENT == null && DATA.size() == 0) try 
				{ 
					DATA.wait(SOTIMEOUT); 
					if (CURRENT == null && DATA.size() == 0) return -1;
				} 
				catch (Exception e) { if (CURRENT == null && DATA.size() == 0) return -1; }
			
			if (CURRENT == null)
			{
				CURRENT = DATA.remove(0);
				OFFSET = 0;
			}
			
				int i = CURRENT[OFFSET++];
				if (OFFSET == CURRENT.length) CURRENT = null;
				
				return i;
			}
		}
	};
	
	private UDPSocket me = this;
	private OutputStream OUTPUTSTREAM = new OutputStream() 
	{
		int buffsize = 1472;
		byte[] buf = null;
		int offset = 0;
		
		@Override
		public void write(int b) throws IOException 
		{
			if (buf == null)
			{
				buf = new byte[buffsize];
				offset = 0;
			}
			buf[offset++] = (byte)b;
			if (offset == buf.length) flush();
		}

		@Override
		public void flush() throws IOException 
		{
			if (offset != buf.length)
			{
				byte[] b = new byte[offset];
				System.arraycopy(buf, 0, b, 0, offset);
				buf = b;
			}
			
			UDPMessage m = new UDPMessage(me, UDPMessage.DATA, LOCALNEXTID++, buf);
			buf = new byte[buffsize];
			offset = 0;

			UDPServerSocket.get(m.getLocalPort()).send(m, false);
		}

		@Override
		public void close() throws IOException 
		{
			flush();
		}
	};
	
	protected UDPSocket(UDPMessage m) 
	{
		LOCALPORT = m.getLocalPort();
		REMOTEPORT = m.getRemotePort();
		REMOTEADDR = m.getRemoteAddress();
		LOCALSOCKID = (int)(Math.random() * Integer.MAX_VALUE); // FIXME - test for remote chance of dupe
		REMOTESOCKID = m.getRemoteSocketID();
		CONNECTED = true;
	}

	public UDPSocket(int localport, String ipaddr, int port) throws Exception
	{
		LOCALPORT = localport;
		REMOTEPORT = port;
		REMOTEADDR = ipaddr;
		LOCALSOCKID = (int)(Math.random() * Integer.MAX_VALUE); // FIXME - test for remote chance of dupe
		
		UDPServerSocket uss = UDPServerSocket.get(port);
		uss.connect(this);
		CONNECTED = true;
	}

	protected void incoming(UDPMessage m) throws IOException 
	{
		CONNECTED = true;
		if (REMOTESOCKID == 0) REMOTESOCKID = m.getRemoteSocketID();
		
		synchronized (DATA)
		{
			long id = m.getID();
			
			if (id < REMOTENEXTID) { /** IGNORE **/ }
			else if (id <= REMOTENEXTID + MAXDROP)
			{
				HOLD.put(id, m);
				
				if (HOLD.get(REMOTENEXTID) == null) requestResend(REMOTENEXTID);
				else while ((m = HOLD.get(REMOTENEXTID)) != null)
				{
					ack(m);
					DATA.addElement(m.getData());
					REMOTENEXTID++;
				}
				
				DATA.notify();
			}
			else requestResend(REMOTENEXTID);
		}
	}

	private void ack(UDPMessage m1) throws IOException 
	{
		UDPMessage m2 = new UDPMessage(this, UDPMessage.ACK, m1.getID(), new byte[0]);
		UDPServerSocket.get(m1.getLocalPort()).send(m2, true);
	}

	private void requestResend(long id) throws IOException 
	{
		UDPMessage m = new UDPMessage(this, UDPMessage.RESEND, id, new byte[0]);
		UDPServerSocket.get(m.getLocalPort()).send(m, true);
	}

	public int getLocalID() 
	{
		return LOCALSOCKID;
	}

	public int getRemoteID() 
	{
		return REMOTESOCKID;
	}

	public int getLocalPort() 
	{
		return LOCALPORT;
	}

	public int getRemotePort() 
	{
		return REMOTEPORT;
	}

	public String getRemoteAddr() 
	{
		return REMOTEADDR;
	}

	public InputStream getInputStream() 
	{
		return INPUTSTREAM;
	}

	public OutputStream getOutputStream() 
	{
		return OUTPUTSTREAM;
	}

	public boolean isClosed() 
	{
		return CLOSED;
	}

	public boolean isConnected() 
	{
		return CONNECTED;
	}

	public void setSoTimeout(int i) 
	{
		SOTIMEOUT = i;
	}

	public void close() throws SocketException
	{
		UDPServerSocket.get(LOCALPORT).close(this);
		CLOSED = true;
	}

	@Override
	public boolean isConnecting() 
	{
		return !(isConnected() || isClosed());
	}

	@Override
	public SocketAddress getRemoteSocketAddress() 
	{
		return new InetSocketAddress(REMOTEADDR, REMOTEPORT);
	}

	@Override
	public String getRemoteHostName() 
	{
		return new InetSocketAddress(REMOTEADDR, REMOTEPORT).getHostName();
	}

	@Override
	public String getLocalHostName() 
	{
		return "localhost";
	}
}
