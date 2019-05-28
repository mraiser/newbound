package com.newbound.net.udp;

import java.net.DatagramPacket;
import java.net.InetSocketAddress;

import com.newbound.robot.BotUtil;

public class UDPMessage 
{
	public static final byte RESEND = 1;
	public static final byte CONNECT = 2;
	protected static final byte DATA = 3;
	protected static final byte ACK = 4;
	protected static final byte PING = 5;
	
	private static final int HEADSIZE = 17;

	
	private int LOCALSOCKID;
	private int REMOTESOCKID;
	private long MSGID;
	private int LOCALPORT;
	private int REMOTEPORT;
	private String REMOTEADDR;
	private byte TYPE;
	
	private byte[] BUF;
	
	protected UDPMessage(DatagramPacket p, int localport) 
	{
		// FOR RECEIVING A MESSAGE
		
		byte[] b = p.getData();
		
		LOCALSOCKID = BotUtil.bytesToInt(b, 0);
		REMOTESOCKID = BotUtil.bytesToInt(b, 4);
		MSGID = BotUtil.bytesToLong(b,8);
		TYPE = b[16];

		LOCALPORT = localport;
		REMOTEPORT = p.getPort();
		REMOTEADDR = p.getAddress().getHostAddress();
		
		if (p.getLength() > HEADSIZE)
		{
			BUF = new byte[p.getLength()-HEADSIZE];
			System.arraycopy(b, p.getOffset()+HEADSIZE, BUF, 0, BUF.length);
		}
		else 
		{
			BUF = new byte[0];
		}
		System.out.println("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
		System.out.println("RECEIVED "+toString());
	}

	protected UDPMessage(UDPSocket sock, byte type, long id, byte[] bs) 
	{
		// FOR SENDING A MESSAGE
		
		LOCALSOCKID = sock.getLocalID();
		REMOTESOCKID = sock.getRemoteID();
		MSGID = id;
		LOCALPORT = sock.getLocalPort();
		REMOTEPORT = sock.getRemotePort();
		REMOTEADDR = sock.getRemoteAddr();
		TYPE = type;
		BUF = bs;
		
		System.out.println("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
		System.out.println("Sending "+toString());
	}

	protected UDPMessage(int localport, InetSocketAddress isa, int localsockid, int remotesockid, byte type, long id, byte[] bs) 
	{
		// FOR SENDING A MESSAGE
		
		LOCALSOCKID = localsockid;
		REMOTESOCKID = remotesockid;
		MSGID = id;
		LOCALPORT = localport;
		REMOTEPORT = isa.getPort();
		REMOTEADDR = isa.getHostString();
		TYPE = type;
		BUF = bs;
		
		System.out.println("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
		System.out.println("Sending "+toString());
	}
	
	public byte[] toBytes() 
	{
		// FOR SENDING A MESSAGE

		byte[] b = new byte[BUF.length+HEADSIZE];
		
		System.arraycopy(BotUtil.intToBytes(REMOTESOCKID), 0, b, 0, 4);
		System.arraycopy(BotUtil.intToBytes(LOCALSOCKID), 0, b, 4, 4);
		System.arraycopy(BotUtil.longToBytes(MSGID), 0, b, 8, 8);
		b[16] = TYPE;
		System.arraycopy(BUF, 0, b, HEADSIZE, BUF.length);
		
		return b;
	}

	public int getLocalSocketID() 
	{
		return LOCALSOCKID;
	}

	public byte[] getData() 
	{
		return BUF;
	}

	public int getLocalPort() 
	{
		return LOCALPORT;
	}

	public int getRemotePort() 
	{
		return REMOTEPORT;
	}

	public String getRemoteAddress() 
	{
		return REMOTEADDR;
	}

	public int getRemoteSocketID() 
	{
		return REMOTESOCKID;
	}

	public long getID() 
	{
		return MSGID;
	}

	public byte getType() 
	{
		return TYPE;
	}

	public String toString()
	{
		return "UDP Message "+MSGID+" of type "+TYPE+" over Socket #"+LOCALSOCKID+"/"+REMOTESOCKID+" with "+REMOTEADDR+":"+REMOTEPORT;
	}
}
