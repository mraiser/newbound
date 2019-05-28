package com.newbound.p2p;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.util.Hashtable;
import java.util.Vector;

import org.json.JSONObject;

import com.newbound.net.service.Socket;
import com.newbound.robot.BotUtil;
import com.newbound.util.ThrottledOutputStream;

public class P2PConnection implements Socket
{
	private long mID = -1;
	private P2PPeer mPeer = null;
	private boolean mConnecting = false;
	private boolean mConnected = false;
	private boolean mClosed = false;
	private Vector<byte[]> mQueue = new Vector();
	private InputStream mInputStream = null;
	private OutputStream mOutputStream = null;
	
	private long mTimeout = 120000;
	private long mNumRead = 0;
//	private long mNumToRead = -1;
//	private long lastcontact = -1;
	
	protected int MTU = 20000;
	
	public P2PConnection(P2PPeer peer) 
	{
		this(peer, random());
	}
	
	private static long random() 
	{
		// FIXME add negatives
		return (long)(Math.random() * Long.MAX_VALUE);
	}

	public P2PConnection(P2PPeer peer, long id) 
	{
		super();
		
		System.out.println("STREAM["+id+"] BEGIN");

		mID = id;
		mPeer = peer;
		MTU = peer.isTCP() || peer.isRelay() ? MTU : peer.MTU - 80;
		
		mInputStream = new InputStream() 
		{
			byte[] bytes = null;
			int offset = 0;
			int len = 0;
			
			public int read() throws IOException 
			{
				if (ensureBytes() == -1) return -1;
//				mPeer.mLastContact = System.currentTimeMillis();
				mNumRead++;
				
//				System.out.println("STREAM["+mID+"] READ 1 BYTE");
				
				return 0xFF & bytes[offset++];
			}

			private int ensureBytes() 
			{
//				System.out.println("STREAM["+mID+"] READ LOOKING FOR BYTES");
				
				if (offset == len) bytes = null;
				if (!mConnected && bytes == null && mQueue.size() == 0) 
				{
					System.out.println("STREAM["+mID+"] READ NO MORE BYTES");
					new Exception().printStackTrace();
					return -1;
				}
				
//				System.out.println("STREAM["+mID+"] READ waiting");
				
				if (bytes == null)
				{
					long now = System.currentTimeMillis();
					
					// FIXME - awkward, unnecessary?
					// Make blocking like ThreadedInputStream
					while (mQueue.size() == 0 && mConnected) try 
					{
						if (System.currentTimeMillis()-now>mTimeout)
						{
							System.out.println("WAITING TOO LONG");
							break;
						}
						Thread.sleep(10); 
					} catch (Exception x) { x.printStackTrace(); }
					
					if (mQueue.size() == 0) 
					{
//						System.out.println("STREAM["+mID+"] READ still nothing, stream done.");
						return -1;
					}
					
					bytes = mQueue.remove(0);
					len = bytes.length;
					offset = 0;
					if (len == 0) 
					{
						bytes = null;
						return ensureBytes();
					}
				}
				
//				System.out.println("CON "+mID+" "+bytes.length+" AVAILABLE");
				
				return bytes.length;
			}

			public int read(byte[] b, int off, int len) throws IOException 
			{
				if (len == 0) return 0;
				
				if (ensureBytes() == -1) return -1;
				
//				mPeer.mLastContact = System.currentTimeMillis();
				
				int n = bytes.length - offset;
				if (len < n) n = len;
				System.arraycopy(bytes, offset, b, off, n);
				offset += n;
				
				int x = len - n;
				if (mQueue.size() > 0)
				{
					n += read(b, off+n, x);
				}
				
//				System.out.println("STREAM["+mID+"] READ "+n+" bytes");

				return n;
			}

			public int available() throws IOException 
			{
				int i = 0;
				if (bytes != null) i += bytes.length - offset;
				int n = mQueue.size();
				while (n-->0) i += mQueue.elementAt(n).length;
				
//				System.out.println("STREAM["+mID+"] AVAILABLE "+i);

				return i;
			}

			public void close() throws IOException 
			{
				super.close();
				if (isConnected()) disconnect();
			}
		};
		
		mOutputStream = new ThrottledOutputStream(new OutputStream() 
		{
			byte[] bytes = new byte[MTU];
			int offset = 0;
			
			public void write(int b) throws IOException 
			{
				bytes[offset++] = (byte)b;
				if (offset == MTU) sendBytes();
//				System.out.println("STREAM["+mID+"] WRITE 1 BYTE");
			}

			public void write(byte[] b, int off, int len) throws IOException 
			{
				int n = 0;
				while (n<len)
				{
					int x = bytes.length - offset;
					if (x>len-n) x = len-n;
					System.arraycopy(b, off, bytes, offset, x);
					offset += x;
					off += x;
					n += x;
				
					if (offset == MTU) sendBytes();
				}
				
//				System.out.println("STREAM["+mID+"] WRITE "+len+" bytes");
			}

			private void sendBytes() throws IOException
			{
				if (offset == 0) return;
				
				try
				{
					byte[] data = new byte[offset];
					System.arraycopy(bytes, 0, data, 0, offset);
//					data = mPeer.encrypt(data);
					mPeer.mP2PManager.stream(mPeer, mID, data);
					
					offset = 0;
				}
				catch (Exception x2) 
				{ 
					x2.printStackTrace();
					throw new IOException(x2.getMessage()); 
				}
			}

			public void close() throws IOException 
			{
				sendBytes();
			}

			public void flush() throws IOException 
			{
				sendBytes();
			}
		}, 80000);
	}
	
	public void connect() throws Exception
	{
		System.out.println("STREAM["+mID+"] CONNECTING");
		mConnecting = true;

		Hashtable<String, String> params = new Hashtable();
		params.put("peer", ""+mPeer.mP2PManager.getLocalID());
		params.put("stream", ""+mID);
		params.put("connect", "true");
		
		P2PCallback cb = new P2PCallback() 
		{
			public P2PCommand execute(JSONObject o) 
			{
				mConnecting = false;
				try { if (!o.getString("status").equals("ok")) mConnected = false; } catch (Exception x) { mConnected = false; x.printStackTrace(); }
				return null;
			}
		};
		
		mPeer.sendCommandAsync("peerbot", "stream", params, cb);

		mConnected = true;
		mPeer.mStreams.put(mID, this);
		
		System.out.println("STREAM["+mID+"] CONNECTED");
	}
	
	public void disconnect()
	{
		System.out.println("STREAM["+mID+"] DISCONNECTING");

//		try { mPeer.flushIncoming(mID); } catch (Exception x) { x.printStackTrace(); }
		// FIXME - closing is not what you think. See STREAM_DIED
		if (!mPeer.closing && mConnected) try
		{
			Hashtable<String, String> params = new Hashtable();
			params.put("peer", ""+mPeer.mP2PManager.getLocalID());
			params.put("stream", ""+mID);
			params.put("connect", "false");
			mPeer.sendCommandAsync("peerbot", "stream", params, new P2PCallback() 
			{
				public P2PCommand execute(JSONObject o) 
				{
					try { if (!o.getString("status").equals("ok")) System.out.println(o.getString("msg")); } catch (Exception x) { x.printStackTrace(); }
					return null;
				}
			});
		}
		catch (Exception x) { x.printStackTrace(); }
		
		mConnected = false;
		mClosed = true;
		mPeer.mStreams.remove(mID);
		
		System.out.println("STREAM["+mID+"] DISCONNECTED");
	}
	
	public OutputStream getOutputStream()
	{
		return mOutputStream;
	}
	
	public InputStream getInputStream()
	{
		return mInputStream;
	}
	
	public long getID() 
	{
		return mID;
	}

	public boolean isConnected() 
	{
		return mConnected;
	}

	public void close() throws IOException 
	{
		disconnect();
		mConnected = false;
		mInputStream.close();
		mOutputStream.flush();
		mOutputStream.close();
	}

	public void sendWebsocketMessage(byte[] msg, int offset, int len, boolean bytes) throws IOException
	{
		OutputStream os = getOutputStream();
		os.write(bytes ? 1 : 0);
		os.write(BotUtil.longToBytes(len));
		os.write(msg, offset, len);
		os.flush();
	}

	public long getNumBytesRead() 
	{
		return mNumRead;
	}

	public SocketAddress getLocalSocketAddress() throws IOException 
	{
		return mPeer.mP2PManager.getLocalSocketAddress();
	}

	public InetSocketAddress getRemoteSocketAddress()
	{
		return mPeer.getRemoteSocketAddress();
	}

	public String getRemoteHostName() throws IOException 
	{
		return mPeer.getRemoteSocketAddress().getHostName();
	}

	public String getLocalHostName() throws IOException 
	{
		return mPeer.getLocalSocketAddress().getHostName();
	}

	public void setConnected(boolean b) 
	{
		mConnected = b;
	}

	public void incoming(byte[] ba) 
	{
		mQueue.addElement(ba);
//		mPeer.mLastContact = System.currentTimeMillis();
	}

	@Override
	public boolean isClosed() 
	{
		return mClosed;
	}

	@Override
	public boolean isConnecting() 
	{
		return mConnecting;
	}

	@Override
	public void setSoTimeout(int millis) 
	{
		mTimeout = millis;
	}
}
