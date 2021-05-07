package com.newbound.p2p;

import java.io.File;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Properties;
import java.util.Vector;

import org.json.JSONObject;

import com.newbound.robot.BotUtil;

public class PeerManager extends BotUtil 
{
	private static Object MUTEX = new Object();
	private static Hashtable<String, P2PPeer> PEERS = new Hashtable();
	
	private File ROOT = null;
	private P2PManager COM = null;

	public PeerManager(P2PManager com, File root)
	{
		COM = com;
		ROOT = root;
	}
	
	private File getPeerFile(String uuid)
	{
		File f = new File (ROOT, "peers");
		f = getSubDir(f, uuid, 2, 3);
		return new File (f, uuid);
	}
	
	public void savePeer(P2PPeer peer) throws IOException
	{
		synchronized (MUTEX)
		{
			File f = getPeerFile(peer.getID());
			f.getParentFile().mkdirs();
			Properties p = new Properties();
			peer.store(p);
			if (peer.hasChanged(p))
			{
				storeProperties(p, f);
				peer.updateSaved(p);
				System.out.println("Saved peer " + peer.getName() + "/" + peer.getID());
			}
//			System.out.println("Unchanged peer " + peer.getName() + "/" + peer.getID());
		}
	}
	
	private P2PPeer loadPeer(String uuid) throws IOException
	{
		try
		{
			synchronized (MUTEX) 
			{
				File f = getPeerFile(uuid);
				Properties p = loadProperties(f);
				return p == null ? null : new P2PPeer(COM, uuid, p);
			}
		}
		catch (Exception x) { x.printStackTrace(); throw new IOException(x.getMessage()); }
	}

	public P2PPeer getPeer(String uuid) throws IOException
	{
//		synchronized (MUTEX)
		{
			P2PPeer p = PEERS.get(uuid); 
			if (p == null) p = loadPeer(uuid);
			if (p == null) 
			{
				p = new P2PPeer(COM, uuid, new Properties());
				savePeer(p);
			}
			
			PEERS.put(uuid, p); 
			
			return p;
		}
	}
/*		
	private P2PPeer getPeer(String uuid, String name, String address, int port) throws Exception
	{
		// FIXME - we are saving the properties file multiple times in rapid succession because confirmSocketAddress saves it too.
		
		synchronized (MUTEX)
		{
			P2PPeer p = getPeer(uuid);
			
			if (p != null) try
			{
				boolean b = name != null && !(""+p.getName()).equals(name);
				if (name != null) p.setName(name);
				if (address != null && port != -1) p.addSocketAddress(new InetSocketAddress(address, port));
				PEERS.put(uuid, p); 
				
				if (b) savePeer(p);
				return p;
			}
			catch (Exception x) { x.printStackTrace(); }
			
			p = new P2PPeer(COM, uuid, name, address, port);
			PEERS.put(uuid, p); 
			
			savePeer(p);
			return p;
		}
	}
*/
	public boolean hasPeer(String id) 
	{
//		return PEERS.contains(id);
		File f = getPeerFile(id);
		return f.exists();
	}

	public void deletePeer(String id) 
	{
		synchronized (MUTEX)
		{
			File f = getPeerFile(id);
			f.delete();
			PEERS.remove(id);
		}
	}

	public void fireEvent(String event, JSONObject data) 
	{
		COM.fireEvent(event, data);
	}

//	public Iterator<P2PPeer> connected() 
//	{
//		return new Vector<P2PPeer>(PEERS.values()).iterator();
//	}

	public boolean isConnected(String id) 
	{
		P2PPeer p = PEERS.get(id);
		if (p != null) return p.isConnected();
		
		return false;
	}

	public boolean isLoaded(String id) 
	{
		P2PPeer p = PEERS.get(id);
		return p != null;
	}
}
