package com.newbound.p2p;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.SocketAddress;
import java.util.Vector;

import com.newbound.net.service.Socket;
import com.newbound.net.service.SocketClosedException;
import com.newbound.net.tcp.TCPSocket;
import com.newbound.net.udp.UDPMessage;
import com.newbound.net.udp.UDPServerSocket;
import com.newbound.robot.BotUtil;
import com.newbound.robot.PeerBot;

public class RelaySocket implements Socket {

	public String RELAYID;
	public String TARGETID;
	
	private Object MUTEX = new Object();
	private Vector<byte[]> DATA = new Vector();

	private int SOTIMEOUT = 120000;
	private boolean ISOPEN = true;
	private boolean ISCLOSED = false;
	
	public RelaySocket(String relay, String target)
	{
		RELAYID = relay;
		TARGETID = target;
		
		try { PeerBot.getPeerBot().getPeer(target).setConnected(true); } catch (Exception x) { x.printStackTrace(); }
	}

	private InputStream INPUTSTREAM = new InputStream() 
	{
		@Override
		public int available() throws IOException 
		{
			if (CURRENT != null) return CURRENT.length - OFFSET;
			if (DATA.size()>0) return DATA.elementAt(0).length;
			return super.available();
		}

		private byte[] CURRENT = null;
		private int OFFSET = 0;
		
		@Override
		public int read() throws IOException 
		{
			if (ISCLOSED) throw new IOException("RelaySocket InputStream is closed");

			synchronized (MUTEX)
			{
				if (!waitForData()) 
					return -1;
				
				int i = CURRENT[OFFSET++];
				if (OFFSET == CURRENT.length) CURRENT = null;
				
				return i;
			}
		}

		private boolean waitForData() 
		{
			if (CURRENT == null && DATA.size() == 0) try { MUTEX.wait(SOTIMEOUT); } catch (Exception e) {}
			if (CURRENT == null && DATA.size() == 0) return false;
			
			if (CURRENT == null)
			{
				CURRENT = DATA.remove(0);
				OFFSET = 0;
			}
			
			return true;
		}

		@Override
		public int read(byte[] b, int off, int len) throws IOException 
		{
			if (ISCLOSED) throw new IOException("RelaySocket InputStream is closed");

			synchronized (MUTEX)
			{
				if (!waitForData()) 
					return -1;
				
				len = Math.min(CURRENT.length - OFFSET, len);
				System.arraycopy(CURRENT, OFFSET, b, off, len);
				OFFSET += len;
				if (OFFSET == CURRENT.length) CURRENT = null;
				
				return len;
			}
		}
	};
	
	private OutputStream OUTPUTSTREAM = new OutputStream() 
	{
		int buffsize = 21000;
		final byte[] buf = new byte[buffsize];
		int offset = 0;
		
		@Override
		public void write(int b) throws IOException 
		{
			if (ISCLOSED) throw new IOException("RelaySocket OutputStream is closed");

			buf[offset++] = (byte)b;
			if (offset == buf.length) flush();
		}

		@Override
		public void write(byte[] b, int off, int len) throws IOException 
		{
			if (ISCLOSED) throw new IOException("RelaySocket OutputStream is closed");

			int len2 = Math.min(len, buf.length-offset);
			System.arraycopy(b, off, buf, offset, len);
			offset += len;
			if (offset == buf.length) flush();
			if (len2<len) write(b, off+len2, len-len2);
		}

		@Override
		public void flush() throws IOException 
		{
//			byte[] b = new byte[offset+36];
//			System.arraycopy(TARGETID.getBytes(), 0, b, 0, 36);
//			System.arraycopy(buf, 0, b, 36, offset);
			byte[] b = new byte[offset];
			System.arraycopy(buf, 0, b, 0, offset);
			P2PSocket s = P2PParser.any(RELAYID, TCPSocket.class);
			if (s == null) throw new IOException("Unable to send data to "+TARGETID+" because connection to relay "+RELAYID+" closed");
			s.send(new P2PResponse(Codes.RELAY, b));
			
			offset = 0;
		}

		@Override
		public void close() throws IOException 
		{
			flush();
		}
	};

	public void incoming(byte[] ba)
	{
		synchronized (MUTEX)
		{
//			int len = ba.length;
//			int code1 = BotUtil.bytesToInt(ba, 0);
//			int code2 = BotUtil.bytesToInt(ba, 36);
//			String s = new String(ba);
			DATA.addElement(ba);
			MUTEX.notify();
		}
	}
	
	@Override
	public InputStream getInputStream() throws IOException 
	{
		return INPUTSTREAM;
	}

	@Override
	public OutputStream getOutputStream() throws IOException 
	{
		return OUTPUTSTREAM;
	}

	@Override
	public void close() throws IOException 
	{
		ISOPEN = false;
		ISCLOSED = true;
	}

	@Override
	public boolean isConnected() 
	{
		return ISOPEN;
	}

	@Override
	public boolean isClosed() 
	{
		return ISCLOSED;
	}
	

	@Override
	public boolean isConnecting() 
	{
		return false;
	}

	@Override
	public SocketAddress getRemoteSocketAddress() 
	{
		return null;
	}

	@Override
	public String getRemoteHostName() throws IOException 
	{
		return null;
	}

	@Override
	public String getLocalHostName() throws IOException 
	{
		return null;
	}

	@Override
	public void setSoTimeout(int millis) throws IOException 
	{
		SOTIMEOUT = millis;
	}

}
