package com.newbound.p2p;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Properties;
import java.util.Vector;

import com.newbound.net.tcp.TCPSocket;
import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.code.Code;
import com.newbound.crypto.SuperSimpleCipher;
import com.newbound.robot.BotBase;
import com.newbound.robot.BotUtil;
import com.newbound.robot.PeerBot;

public class P2PPeer
{
	private static final int MAXMTU = 2048; // 512;

//	private static long mNextPeerID = 1;
//	private static Hashtable<Long, P2PPeer> mPeers = new Hashtable();
	
	private String mID;
	private String mName;
	private byte[] mPublicKey = null;
	private SuperSimpleCipher mReadKey = null;
	private SuperSimpleCipher mWriteKey = null;
	private boolean mKeepAlive = false;
	private int mPort = -1;
	private boolean connected = false;
	
	protected long nextsendcommand = 0;

	protected Hashtable<Long, P2PCommand> mCommands = new Hashtable();
	protected Hashtable<Long, P2PConnection> mStreams = new Hashtable();
	
	protected P2PManager mP2PManager = null;

//	protected long mLocal = mNextPeerID++;
//	protected long mRemote = -1;
	protected int MTU = MAXMTU;
	
//	private Vector<String> mRelays = new Vector();
	public Vector<InetSocketAddress> mKnownAddresses = new Vector();
	public Vector<InetSocketAddress> mSeenAddresses = new Vector();
	
	public String code = null;

	private long mLastContact;
//	protected long mLastSend;
	private Properties OPROP;

	public boolean closing = false;
	
	protected P2PPeer(P2PManager pm, String uuid, String name, String address, int port) throws Exception
	{
		this(pm, uuid, new Properties());
		mName = name;
		addSocketAddress(new InetSocketAddress(address, port));
	}

	public P2PPeer(P2PManager pm, String uuid, Properties p) throws IOException
	{
		super();
		OPROP = (Properties) p.clone();
//		mPeers.put(mLocal, this);
		
		mID = uuid;
		mName = p.getProperty("name");
		if (mName == null) mName = "UNKNOWN";
		mP2PManager = pm;
		
		try
		{
			String s = p.getProperty("pubkey");
			if (s != null) mPublicKey = BotUtil.fromHexString(s);
			
			s = p.getProperty("readkey");
			if (s != null) mReadKey = new SuperSimpleCipher(BotUtil.fromHexString(s), false);
			
			s = p.getProperty("writekey");
			if (s != null) mWriteKey = new SuperSimpleCipher(BotUtil.fromHexString(s), true);
			else mWriteKey = new SuperSimpleCipher(SuperSimpleCipher.getSeed(SuperSimpleCipher.KEYSIZE), true);
			
			s = p.getProperty("addresses");
			if (s != null) try
			{
				JSONArray ja = new JSONArray(s);
				int n = ja.length();
				for (int i=0;i<n;i++) try
				{
					JSONArray ja2 = ja.getJSONArray(i);
					addSocketAddress(new InetSocketAddress(ja2.getString(0), ja2.getInt(1)));
				}
				catch (Exception x) { x.printStackTrace(); }
			}
			catch (Exception x) { x.printStackTrace(); }
			
			s = p.getProperty("keepalive");
			if (s != null) mKeepAlive = Boolean.parseBoolean(s);
			
			s = p.getProperty("port");
			if (s != null) mPort = Integer.parseInt(s);
	
			s = p.getProperty("address");
			if (s!= null) addSocketAddress(new InetSocketAddress(s, mPort));
	
			s = p.getProperty("local");
			if (s!= null) addSocketAddress(new InetSocketAddress(s, mPort));
		}
		catch (Exception x)
		{
			x.printStackTrace();
			throw new IOException(x.getMessage());
		}
	}
	
//	public static P2PPeer get(long id)
//	{
//		return mPeers.get(id);
//	}
	
	public void store(Properties p) 
	{
		p.setProperty("name", mName);
		if (mPublicKey != null) p.setProperty("pubkey", BotUtil.toHexString(mPublicKey));
		if (mReadKey != null) p.setProperty("readkey", BotUtil.toHexString(mReadKey.toBytes()));
		if (mWriteKey != null) p.setProperty("writekey", BotUtil.toHexString(mWriteKey.toBytes()));
		
		JSONArray ja = new JSONArray();
		int i = mKnownAddresses.size();
		while (i-->0)
		{
			InetSocketAddress isa = mKnownAddresses.elementAt(i);
			JSONArray ja2 = new JSONArray();
			ja2.put(isa.getHostString());
			ja2.put(isa.getPort());
			ja.put(ja2);
			if (mPort == -1) mPort = isa.getPort();
		}
		p.setProperty("addresses", ja.toString());

		p.setProperty("uuid", mID);
		p.setProperty("keepalive", ""+mKeepAlive);
		p.setProperty("port", ""+mPort);
	}
	
//	Hashtable<Long, Vector<byte[]>> mIncoming = new Hashtable(); 
	
	public void closeStream(long mid)
	{
		System.out.println("STREAM["+mid+"] closed");
		P2PConnection con = mStreams.get(mid);
		if (con != null) try { con.close(); } catch (Exception x) { x.printStackTrace(); }
		mStreams.remove(mid);
	}
	
	public void stream(byte[] ba) throws Exception 
	{
		mLastContact = System.currentTimeMillis();
		
		final long mid = BotUtil.bytesToLong(ba, 0);
		int n = ba.length-8;
		byte[] msg = new byte[n];
		System.arraycopy(ba, 8, msg, 0, n);

//		Vector<byte[]> v = mIncoming.get(mid);
//		if (v == null) mIncoming.put(mid, v = new Vector());
//		v.addElement(msg);
		
		System.out.println("STREAM["+mid+"/"+mID+"] got "+n+" bytes");
		
//		flushIncoming(mid);
		
		P2PConnection con = mStreams.get(mid);
		if (con == null) mP2PManager.sendBytes(Codes.STREAM_DIED, this, BotBase.longToBytes(mid));
		else con.incoming(msg);
	}
/*	
	protected void flushIncoming(long mid) throws Exception 
	{
		P2PConnection con = mStreams.get(mid);
		if (con != null) 
		{
			Vector<byte[]> v = mIncoming.get(mid);
			if (v != null) while (v.size() > 0)
			{
				byte[] msg = v.remove(0);
				byte[] ba = decrypt(msg, 0, msg.length);
				con.incoming(ba);
			}
		}
	}
*/
	public void response(byte[] msg) throws Exception 
	{
		mLastContact = System.currentTimeMillis();
		
		long mid = BotUtil.bytesToLong(msg, 0);
		
		final P2PCommand c = mCommands.remove(mid);
		if (c != null)
		{
			if (c.mP2PCallback != null) try
			{
				String s = new String(msg, 8, msg.length-8);
				System.out.println("RESPONSE["+mid+"/"+mID+"] got "+s);

				final JSONObject o = new JSONObject(s);
				Runnable r = new Runnable() 
				{
					public void run() 
					{
						try
						{
							P2PCommand c2 = c.mP2PCallback.execute(o);
							if (c2 != null) try { sendCommandAsync(c2); } catch (Exception x) { x.printStackTrace(); }
						}
						catch (Exception x) { x.printStackTrace(); }
					}
				};
				mP2PManager.addJob(r, "P2P Callback");
			}
			catch (Exception x) { x.printStackTrace(); }
			
		}
		else System.out.println("Unexpected response "+mid+" from "+mID);
	}
	
	public void command(byte[] msg) throws Exception 
	{
		mLastContact = System.currentTimeMillis();
		
		long mid = BotUtil.bytesToLong(msg, 0);
		String s = new String(msg, 8, msg.length-8);
		
		System.out.println("COMMAND["+mid+"/"+mID+"] got "+s);
		
		JSONObject o = new JSONObject(s);
	
		String bot = o.getString("bot");
		String cmd = o.getString("cmd");

		try
		{
			JSONObject jo;
			
			try
			{
				Hashtable params = new Hashtable();
				JSONObject o2 = o.getJSONObject("params");
				Iterator<String> i = o2.keys();
				while (i.hasNext())
				{
					String key = i.next();
					Object val = o2.get(key);
					params.put(key, ""+val);
				}
				params.put("sessionid", mID);
				
				BotBase b = BotBase.getBot(bot);
				Properties user = b.getUserProperties(mID, true);
				Hashtable ses = b.getSession(mID, true);
				ses.put("username", mID);
				ses.put("peer", this);
				ses.put("displayname", mName);
				ses.put("user", user);
				ses.put("emailusername", mID);
				ses.put("emailuser", user);

				if (b.requirePassword()) b.validateRequest(b, cmd, params);
				
				Object r = b.handleCommand(cmd, params);
				
				if (r instanceof String) r = new JSONObject("{ \"status\": \"ok\", \"msg\": \""+r+"\" }");
				else if (r instanceof File)
				{
					File f = BotUtil.newTempFile();
					BotUtil.copyFile((File)r, f);
					r = new JSONObject("{ \"status\": \"ok\", \"msg\": \""+f.getName()+"\" }");
				}
				
				jo = (JSONObject)r;
			}
			catch (Exception x)
			{
				System.err.println(bot+":"+cmd+" ERROR "+x.getMessage());
//				x.printStackTrace();
				jo = new JSONObject();
				jo.put("status", "err");
				jo.put("msg", x.getMessage());
			}
			mP2PManager.respond(this, mid, jo);
		}
		catch (Exception x) 
		{ 
			x.printStackTrace(); 
		}
		
	}

	public JSONObject sendCommand(String bot, String cmd, Hashtable<String, String> params) throws Exception
	{
		return sendCommand(bot, cmd, params, 30000);
	}
	
	public JSONObject sendCommand(final String bot, final String cmd, Hashtable<String, String> params, final long millis) throws Exception
	{
//		System.out.println("BLOCK1");

		final JSONObject[] out = { null };
				
		P2PCallback cb = new P2PCallback() 
		{
			public P2PCommand execute(JSONObject result) 
			{
				long when = System.currentTimeMillis();
//				System.out.println("BLOCK2 "+(System.currentTimeMillis()-when)+"ms "+bot+"/"+cmd);
				out[0] = result;
				return null;
			}
		};
		
		sendCommandAsync(bot, cmd, params, cb);
	
		long when = System.currentTimeMillis()+millis;
		while (when>System.currentTimeMillis() && out[0] == null)
//		synchronized(out)
		{
//			out.wait(millis);
			Thread.sleep(10);
		}
		
		System.out.println("COMMAND "+bot+"/"+cmd+" executed in "+(System.currentTimeMillis()-(when-millis))+"ms");

		if (out[0] == null) 
		{
			System.out.println("Can't send "+cmd+" to "+bot);
			out[0] = new JSONObject("{\"status\": \"err\", \"msg\": \"Broken connection\"}");
			throw new Exception("Can't send "+cmd+" to "+mID+"/"+bot+" (timeout) "+Thread.currentThread());
		}
//		System.out.println("BLOCK4");
		return out[0];
	}
	
	public void sendCommandAsync(String bot, String cmd, Hashtable<String, String> params, P2PCallback cb) throws Exception
	{
		P2PCommand p2pcmd = new P2PCommand(bot, cmd, params, cb);
		sendCommandAsync(p2pcmd);
	}

	private void sendCommandAsync(P2PCommand p2pcmd) throws Exception
	{
//		synchronized (mSendMutex)
//		{
			mP2PManager.sendCommand(this, p2pcmd);
//		}
	}

	public InetSocketAddress getRemoteSocketAddress() 
	{ 
		return getSocketAddress();
	}
	
	// FIXME - REMOVE
	public InetSocketAddress getLocalSocketAddress() 
	{
		return (InetSocketAddress)mP2PManager.getLocalSocketAddress(); 
	}

	public Vector<InetSocketAddress> getknownSocketAddresses() 
	{
		return mKnownAddresses;
	}

	public String getID() 
	{
		return mID;
	}

	public byte[] getPublicKey() 
	{
		return mPublicKey;
	}

	public void setPublicKey(byte[] pk) 
	{
		mPublicKey = pk;
		try { mP2PManager.savePeer(this); } catch (Exception x) { x.printStackTrace(); }
	}

	public SuperSimpleCipher getReadKey() 
	{
		return mReadKey;
	}

	public SuperSimpleCipher getWriteKey() 
	{
		return mWriteKey;
	}

	public void setName(String name) 
	{
		boolean b = !(""+name).equals(""+mName);
		mName = name;
		if (b) try 
		{ 
			mP2PManager.savePeer(this); 
			mP2PManager.fireEvent("update", new JSONObject(this.toString())); 
		} 
		catch (Exception x) { x.printStackTrace(); }
	}

	public boolean hasChanged(Properties p)
	{
		return !OPROP.equals(p);
	}

	public void updateSaved(Properties p)
	{
		OPROP = (Properties) p.clone();
	}

	public void addSocketAddress(InetSocketAddress isa) throws Exception 
	{
//		mP2PManager.sendUDP(isa, Codes.PING, mID.getBytes());
		confirmSocketAddress(isa);
	}
	
	public void confirmSocketAddress(final InetSocketAddress isa) 
	{
		if (mSeenAddresses.indexOf(isa) == -1) try
		{
			mSeenAddresses.addElement(isa);

			TCPSocket sock = new TCPSocket(isa.getHostString(), isa.getPort(), 1000);
			sock.setSoTimeout(100);
			InputStream is = sock.getInputStream();
			byte[] ba = new byte[36];
			int n = is.read(ba);
			if (n == 36)
			{
				String id = new String(ba);
				if (mID.equals(id))
				{
					mKnownAddresses.addElement(isa);
					mP2PManager.savePeer(this);
					try { mP2PManager.fireEvent("update", new JSONObject(this.toString())); } catch (Exception x) { x.printStackTrace(); }
					return;
				}

			}
		}
		catch (Exception x) { System.out.println("Unable to reach "+mName+" at "+isa+" ("+x.getMessage()+")"); }

		mKnownAddresses.removeElement(isa);
		try { mP2PManager.savePeer(this); } catch (Exception x) { x.printStackTrace(); }
	}

	public void addConfirmedAddress(InetSocketAddress isa) 
	{
		if (mKnownAddresses.indexOf(isa) == -1) 
		{
			mKnownAddresses.addElement(isa);
			try { mP2PManager.savePeer(this); } catch (Exception x) { x.printStackTrace(); }
			try { mP2PManager.fireEvent("update", new JSONObject(this.toString())); } catch (Exception x) { x.printStackTrace(); }
		}
		
//		if (!isTCP())
//		{
//			try { mP2PManager.initiateTCPConnection(this, isa); }
//			catch (Exception x) { System.out.println("TCP Unable to reach "+mName+" at "+isa); }
//		}
	}
	
	public void removeSocketAddress(InetSocketAddress isa) 
	{
//		synchronized(mKnownAddresses)
		{
			if (mKnownAddresses.size()>1)
			{
				if (mKnownAddresses.remove(isa))
				{
					try { mP2PManager.savePeer(this); } catch (Exception x) { x.printStackTrace(); }
					try { mP2PManager.fireEvent("update", new JSONObject(this.toString())); } catch (Exception x) { x.printStackTrace(); }
				}
			}
		}
	}

	public String getName() 
	{
		return mName;
	}

	public void setReadKey(SuperSimpleCipher rk) 
	{
		mReadKey = rk;
	}

	public void setReadKey(byte[] rk) throws Exception
	{
		boolean b = mReadKey == null;
		mReadKey = b ? new SuperSimpleCipher(rk, false) : null;
		if (b) mP2PManager.savePeer(this);
	}

//	private byte[] decrypt(byte[] ba) throws Exception 
//	{
//		return decrypt(ba, 0, ba.length);
//	}

	public byte[] decrypt(byte[] ba, int off, int len) throws Exception 
	{
//		synchronized (mReadKey)
		{
			return mReadKey.decrypt(ba, off , len);
		}
	}

//	public byte[] encrypt(byte[] ba) throws Exception
//	{
//		return encrypt(ba, 0, ba.length);
//	}

	public byte[] encrypt(byte[] ba, int off, int len) throws Exception
	{
//		synchronized (mWriteKey) 
		{
			return mWriteKey.encrypt(ba, off, len);
		}
	}
/*
	public long getLocalID() 
	{
		return mLocal;
	}

	public long getRemoteID() 
	{
		return mRemote;
	}

	public void setRemoteID(long peer) 
	{
		mRemote = peer;
	}
*/
	public String toString()
	{
		InetSocketAddress local = getLocalSocketAddress(); // FIXME - We want the peer's address not our own
		String localip = local != null ? local.getHostString() : getAddress();
		
		JSONObject jo = new JSONObject();
		try { jo.put("id",  mID); } catch (Exception x) { x.printStackTrace(); }
		try { jo.put("name",  mName); } catch (Exception x) { x.printStackTrace(); }
		try { jo.put("connected",  isConnected()); } catch (Exception x) { x.printStackTrace(); }
		try { jo.put("addr",  getAddress()); } catch (Exception x) { x.printStackTrace(); }
		try { jo.put("port",  getPort()); } catch (Exception x) { x.printStackTrace(); }
		try { jo.put("keepalive",  mKeepAlive); } catch (Exception x) { x.printStackTrace(); }
		try { jo.put("localip",  localip); } catch (Exception x) { x.printStackTrace(); }
//		try { jo.put("localid",  mLocal); } catch (Exception x) { x.printStackTrace(); }
//		try { jo.put("remoteid",  mRemote); } catch (Exception x) { x.printStackTrace(); }
		try { jo.put("lastcontact",  mLastContact); } catch (Exception x) { x.printStackTrace(); }

		try { jo.put("addresses",  buildAddressList()); } catch (Exception x) { x.printStackTrace(); }
		try { jo.put("relays",  relays()); } catch (Exception x) { x.printStackTrace(); }

		try { jo.put("tcp",  isTCP()); } catch (Exception x) { x.printStackTrace(); }
		try { jo.put("udp",  isUDP()); } catch (Exception x) { x.printStackTrace(); }

		try { jo.put("strength",  mP2PManager.strength(this)); } catch (Exception x) { x.printStackTrace(); }
		
		return jo.toString();
	}
/*
	public void addRelay(P2PPeer peer) 
	{
		if (mRelays.indexOf(peer.getID()) == -1 && peer.isConnected() && !peer.getID().equals(mID)) 
		{
			mRelays.addElement(peer.getID());
			try { mP2PManager.fireEvent("update", new JSONObject(this.toString())); } catch (Exception x) { x.printStackTrace(); }
		}
		
	}
*/
	public JSONArray relays() 
	{
		return mP2PManager.relays(mID);
	}
/*
	public boolean removeRelay(P2PPeer peer) 
	{
		boolean b = mRelays.removeElement(peer.getID());
		try { if (b) mP2PManager.fireEvent("update", new JSONObject(this.toString())); } catch (Exception x) { x.printStackTrace(); }
		return b;
	}
*/
	private JSONArray buildAddressList() 
	{
		JSONArray addresses = new JSONArray();
        Enumeration<InetSocketAddress> a = mKnownAddresses.elements();
        for (; a.hasMoreElements();)
        {
            InetSocketAddress addr = a.nextElement();
           	addresses.put(addr.getHostString()+":"+addr.getPort());
        }

		return addresses;
	}

	public boolean isConnected() 
	{
		return connected;
	}

//	public void clearKnownAddresses() 
//	{
//		mKnownAddresses = new Vector();
//	}
/*
	public void addTickleBack(InetSocketAddress addisa) 
	{
		InetSocketAddress isa = new InetSocketAddress(addisa.getAddress(), addisa.getPort());
//		synchronized (mTickleBacks) //too many threads locking, sorry. Deal with the occasional duplicates and extra events.
		{
			if (mTickleBacks.indexOf(isa) == -1) 
			{
				mTickleBacks.addElement(isa);
				try { mP2PManager.fireEvent("update", new JSONObject(this.toString())); } catch (Exception x) { x.printStackTrace(); }
			}
		}
		addSocketAddress(isa);
	}

	public Vector<InetSocketAddress> getTickleBacks() 
	{
		return mTickleBacks;
	}
*/
	public void setConnected(boolean b) 
	{
		boolean bb = connected;
		connected = b;
		if (bb != b)
		{
			try 
			{
				if (bb)
					mP2PManager.fireEvent("disconnect", new JSONObject(toString()));
				else {
					mLastContact = System.currentTimeMillis();
					mP2PManager.fireEvent("connect", new JSONObject(toString()));
				}
			} 
			catch (Exception x) { x.printStackTrace(); } 
		}
	}

	public P2PConnection newStream() throws Exception
	{
		P2PConnection con = new P2PConnection(this);
		con.connect();
		return con;
	}

	public P2PConnection getStream(long id) 
	{
		return mStreams.get(id);
	}

	public void accept(P2PConnection con) 
	{
		System.out.println("accepting stream "+con.getID());
		mStreams.put(con.getID(), con);
		con.setConnected(true);
		System.out.println("accepted stream "+con.getID());
	}

	public void remove(final long stream)
	{
		// FIXME is delay necessary?
		
		mP2PManager.setTimeout(new Runnable() 
		{
			@Override
			public void run() 
			{
				System.out.println("REMOVING STREAM "+mID);

				P2PConnection con = mStreams.remove(stream);
				if (con != null) try
				{
					con.setConnected(false);
					con.getInputStream().close();
					con.getOutputStream().flush();
					con.getOutputStream().close();
				}
				catch (Exception x) { x.printStackTrace(); }
			}
		}, "REMOVE STREAM "+mID, 1000);
	}

	public void keepAlive(boolean keepalive) 
	{
		mKeepAlive = keepalive;
	}

	public boolean keepAlive() 
	{
		return mKeepAlive;
	}

	public InetSocketAddress getSocketAddress()
	{
//		synchronized (mKnownAddresses)
		{
			if (mKnownAddresses.size() > 0)
			{
				return mKnownAddresses.get(0);			
			}
		}
		
		return null;
	}
	
	public String getAddress() 
	{
		InetSocketAddress isa = getSocketAddress();
		if (isa != null) return isa.getHostString();
		return "127.0.0.1";
	}

	public int getPort() 
	{
		if (mPort == -1)
		{
			InetSocketAddress isa = getSocketAddress();
			if (isa != null) return isa.getPort();
		}
		return mPort;
	}

	public long lastContact() 
	{
		return mLastContact;
	}

	public void updateLastContact() {
		mLastContact = System.currentTimeMillis();
	}

	public void setPort(int port) 
	{
		int old = mPort;
		mPort = port;
		try { if (old != port) mP2PManager.savePeer(this); } catch (Exception x) { x.printStackTrace(); }
	}

	public boolean isTCP() 
	{
		return mP2PManager.isTCP(mID);
	}

	public boolean isRelay() 
	{
		return mP2PManager.isRelay(mID);
	}

	public boolean isUDP() 
	{
		return mP2PManager.isUDP(mID);
	}

	public void disconnect() throws IOException 
	{
		mP2PManager.disconnect(mID);
	}

}
