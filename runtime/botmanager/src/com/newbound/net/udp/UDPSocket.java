package com.newbound.net.udp;

import java.io.*;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.util.Arrays;
import java.util.Vector;

import com.newbound.net.service.Socket;

public class UDPSocket implements Socket
{
	protected int MTU = 1400; // FIXME - should be 1500 - headersize

	private UDPServerSocket SOCK;
	private String SESSION;
	private InetAddress ADDR;
	private int PORT;

	private PipedOutputStream INCOMING = new PipedOutputStream();
	private PipedInputStream MYINPUTSTREAM = null;
	private ByteArrayOutputStream OUTGOING = new ByteArrayOutputStream();
	private OutputStream MYOUTPUTSTREAM = null;

	private static byte CONNECTING = 0;
	private static byte CONNECTED = 1;
	private static byte DEAD = 2;

	private Vector<byte[]> SENT = new Vector<>();
	private int SENTOFFSET = 0;
	private int SENTNEXT = 0;

	public long LASTCONTACT;
	public long LASTRESEND;
	public int SOTIMEOUT = 10000;

	private Vector<byte[]> RECVD = new Vector<>();
	private int RECVDOFFSET = 0;
	private int RECVDLAST = -1;

	private byte STATE = CONNECTING;

	public UDPSocket(UDPServerSocket udpServerSocket, String session, InetAddress addr, int port) {
		SOCK = udpServerSocket;
		SESSION = session;
		ADDR = addr;
		PORT = port;
		LASTCONTACT = LASTRESEND = System.currentTimeMillis();
		STATE = CONNECTED;
	}

	@Override
	public InputStream getInputStream() throws IOException {
		if (MYINPUTSTREAM == null) MYINPUTSTREAM = new PipedInputStream(INCOMING);
		return MYINPUTSTREAM;
	}

	@Override
	public OutputStream getOutputStream() throws IOException {
		if (MYOUTPUTSTREAM == null) MYOUTPUTSTREAM = new OutputStream() {

			@Override
			public void write(int i) throws IOException {
				//if ((SENTNEXT - SENTOFFSET)>20) try { Thread.sleep(100); } catch (Exception x) { x.printStackTrace(); }
				OUTGOING.write(i);
				if (OUTGOING.size() >= MTU) flush();
			}
			@Override
			public void flush() throws IOException {
				ByteArrayOutputStream baos = OUTGOING;
				if (baos.size()>0) {
					OUTGOING = new ByteArrayOutputStream();
					baos.close();
					byte[] ba = baos.toByteArray();
					SENT.addElement(ba);
					SOCK.send(SESSION, SENTNEXT++, ba, ADDR, PORT); // FIXME - if SENTLAST - SENTOFFSET > MAX don't send more
					//System.out.println((SENTNEXT - SENTOFFSET)+" packets in SENT queue");
				}
			}
		};
		return MYOUTPUTSTREAM;
	}

	@Override
	public void close() throws IOException {
		STATE = DEAD;
		try { getInputStream().close(); }
		finally { getOutputStream().close(); }
	}

	@Override
	public boolean isConnected() {
		return STATE == CONNECTED;
	}

	@Override
	public boolean isClosed() {
		return STATE == DEAD;
	}

	@Override
	public boolean isConnecting() {
		return STATE == CONNECTING;
	}

	@Override
	public InetSocketAddress getRemoteSocketAddress() {
		return new InetSocketAddress(ADDR, PORT);
	}

	@Override
	public String getRemoteHostName() throws IOException {
		return ADDR.getHostName();
	}

	@Override
	public String getLocalHostName() throws IOException {
		return SOCK.getInetAddress().getHostName();
	}

	@Override
	public void setSoTimeout(int millis) throws IOException {
		SOTIMEOUT = millis;
	}

	public void resend(int msgid) throws IOException {
		ack(msgid-1);
		int off = msgid - SENTOFFSET;
		int n = 0;
		while (off<SENT.size()){
			byte[] ba = SENT.elementAt(off);
			SOCK.send(SESSION, off + SENTOFFSET, ba, ADDR, PORT);
			if (++n == 10) break;
			off++;
		}
	}

	public void ack(int msgid){
		while (SENTOFFSET<msgid){
			SENT.remove(0);
			SENTOFFSET++;
		}
	}

	public void incoming(int msgid, byte[] b, int off, int len) throws IOException {
		LASTCONTACT = System.currentTimeMillis();
		updateRecvdLast(msgid);
		int n = msgid - RECVDOFFSET;
		if (n>=0 && RECVD.elementAt(n) == null) {
			b = Arrays.copyOfRange(b, off, off+len);
			RECVD.set(n, b);
			while (RECVDOFFSET<=RECVDLAST){
				if (RECVD.elementAt(0) == null) break;
				byte[] msg = RECVD.remove(0);
				RECVDOFFSET++;
				INCOMING.write(msg);
			}
		}
	}

	public void requestResend() throws IOException {
		LASTRESEND = System.currentTimeMillis();
		//System.out.println("Requesting resend of "+RECVDOFFSET+"/"+SESSION);
		SOCK.requestResend(SESSION, RECVDOFFSET, ADDR, PORT);
	}

	private void updateRecvdLast(int msgid) {
		int n = RECVDLAST;
		while (n++<msgid) RECVD.addElement(null);
		if (msgid>RECVDLAST) RECVDLAST = msgid;
	}

	public boolean needsResend() {
		boolean b = RECVDOFFSET<=RECVDLAST && RECVD.elementAt(0) == null;
		//if (b) System.out.println("NEEDS RESEND");
		return b;
	}
}
