package com.newbound.net.udp;

import java.io.*;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.util.Vector;

import com.newbound.net.service.Socket;

public class UDPSocket implements Socket
{
	private int MTU = 1400; // FIXME - should be 1500 - headersize

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
	public int SOTIMEOUT = 10000;

	class RecvdMsg{
		byte[] ba;
		int off;
		int len;
		RecvdMsg(byte[] ba, int off, int len){
			this.ba = ba;
			this.off = off;
			this.len = len;
		}
	}

	private Vector<RecvdMsg> RECVD = new Vector<>();
	private int RECVDOFFSET = 0;
	private int RECVDLAST = -1;

	private byte STATE = CONNECTING;

	public UDPSocket(UDPServerSocket udpServerSocket, String session, InetAddress addr, int port) {
		SOCK = udpServerSocket;
		SESSION = session;
		ADDR = addr;
		PORT = port;
		LASTCONTACT = System.currentTimeMillis();
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
		return SOCK.getInetAddress().getHostName(); // FIXME - Is this correct?
	}

	@Override
	public void setSoTimeout(int millis) throws IOException {
		SOTIMEOUT = millis;
	}

	public byte[] getSentMsg(int msgid) {
		ack(msgid-1);
		int off = msgid - SENTOFFSET;
		if (off<SENT.size())
			return SENT.elementAt(off); // FIXME - should always be zero or one?

		return null;
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
		if (n>=0) RECVD.set(n, new RecvdMsg(b, off, len));
		pushRecvd();
	}

	private void pushRecvd() throws IOException {
		while (RECVDOFFSET<=RECVDLAST){
			if (RECVD.elementAt(0) == null) break;
			RecvdMsg msg = RECVD.remove(0);
			RECVDOFFSET++;
			INCOMING.write(msg.ba, msg.off, msg.len);
		}

		if (RECVDOFFSET<=RECVDLAST) requestResend();
		//else SOCK.sendACK(SESSION, RECVDLAST, ADDR, PORT);
	}

	public void requestResend() throws IOException {
		SOCK.requestResend(SESSION, RECVDOFFSET, ADDR, PORT);
	}

	private void updateRecvdLast(int msgid) {
		int n = RECVDLAST;
		while (n++<msgid) RECVD.addElement(null);
		if (msgid>RECVDLAST) RECVDLAST = msgid;
	}
}
