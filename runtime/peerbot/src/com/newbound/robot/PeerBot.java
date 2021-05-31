package com.newbound.robot;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.MalformedURLException;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLEncoder;
import java.nio.channels.DatagramChannel;
import java.security.KeyPair;
import java.security.Provider;
import java.security.Security;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Properties;
import java.util.UUID;
import java.util.Vector;

import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.crypto.SuperSimpleCipher;
import com.newbound.net.mime.MIMEMultipart;
import com.newbound.net.service.PipeStreamer;
import com.newbound.net.service.SocketClosedException;
import com.newbound.net.service.http.HTTPResponse;
import com.newbound.net.service.http.WebSocket;
import com.newbound.p2p.P2PManager;
import com.newbound.p2p.P2PCallback;
import com.newbound.p2p.P2PCommand;
import com.newbound.p2p.P2PConnection;
import com.newbound.p2p.P2PPeer;
import com.newbound.thread.PeriodicTask;
import com.newbound.util.NoDotFilter;

//import de.tud.kom.nat.comm.msg.IPeerID;
//import de.tud.kom.nat.comm.msg.Peer;

public class PeerBot extends MetaBot 
{
	private static final int NUMPEERBOTTHREADS = 103;
	
	private static P2PManager mP2PManager = null;
	private Hashtable<WebSocket, P2PConnection> mRemoteWebSockets = new Hashtable<WebSocket, P2PConnection>();
	
	public PeerBot()
	{
		super();
//		LIBRARIES = new String[] { "coreapps" };
	}
	
	public Object handleCommand(String cmd, Hashtable params) throws Exception 
	{
//		if (cmd.equals("relay")) return handleRelay(params);
//		if (cmd.equals("packet")) return handlePacket(params);
		if (cmd.equals("register")) return handleRegister(params);
		if (cmd.equals("noop")) return handleNOOP(params);
		if (cmd.equals("lookup")) return handleLookUp(params);
		if (cmd.equals("listzeroconf")) return handleListZeroConf(params);
		if (cmd.equals("getpeerid")) return handleGetPeerID(params);
		if (cmd.equals("getpeerinfo")) return handleGetPeerInfo(params);
		if (cmd.equals("getmachineid")) return handleGetMachineID(params);
		if (cmd.equals("connectionstatus")) return handleConnectionStatus(params);
		if (cmd.equals("connect")) return handleConnect(params);
		if (cmd.equals("disconnect")) return handleDisconnect(params);
		if (cmd.startsWith("remote/")) return handleRemote(cmd, params);
		if (cmd.equals("local")) return handleLocal(cmd, params);
		if (cmd.equals("stream")) return handleStream(cmd, params);
		if (cmd.equals("websocket")) return handleWebsocket(cmd, params);
		if (cmd.equals("connections")) return handleConnections(params);
		if (cmd.equals("accesscodes")) return handleAccessCodes(params);
		if (cmd.equals("suggestaccesscode")) return handleSuggestAccessCode(params);
		if (cmd.equals("addaccesscode")) return handleAddAccessCode(params);
		if (cmd.equals("accesscode")) return handleAccessCode(params);
		if (cmd.equals("deleteaccesscode")) return handleDeleteAccessCode(params);
		if (cmd.equals("newconnection")) return handleNewConnection(cmd, params);
		if (cmd.equals("togglekeepalive")) return handleToggleKeepAlive(cmd, params);
		if (cmd.equals("deletepeer")) return handleDeletePeer(cmd, params);
//		if (cmd.equals("sendpacket")) return handleSendPacket(cmd, params);
		if (cmd.equals("tempfile")) return handleTempfile(cmd, params);
		if (cmd.equals("shutdown")) return handleShutdown(params); // FIXME - REMOVE 
		if (cmd.equals("allowanon")) return handleAllowAnon(params);
		if (cmd.equals("subscribe")) return handleSubscribe(params);
		if (cmd.equals("available")) return handleAvailable(params);
		if (cmd.equals("pubkey")) return handlePubKey(params);
		if (cmd.equals("setpubkey")) return handleSetPubKey(params);
		if (cmd.equals("setreadkey")) return handleSetReadKey(params);
		if (cmd.equals("brokers")) return handleBrokers(params);
		if (cmd.equals("localaddresses")) return handleLocalAddresses(params);
		throw new Exception("Unknown command: "+cmd);
	}

	public JSONObject getCommands()
	{
		JSONObject commands = new JSONObject();
		JSONObject cmd;

		try {
			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Send information on how to locate yourself to another peer.");
			cmd.put("parameters", new JSONArray("[\"uuid\",\"local\",\"addresses\",\"port\",\"name\"]"));
			commands.put("register", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Do nothing.");
			commands.put("noop", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Returns the connection information for a specific device.");
			cmd.put("parameters", new JSONArray("[\"uuid\"]"));
			commands.put("lookup", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "Deprecated. Do not use. Use botmanager/discover instead.");
			commands.put("listzeroconf", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Returns the universal ID of this device.");
			commands.put("getpeerid", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Returns the connection information about this device.");
			commands.put("getpeerinfo", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Returns the name of this device.");
			commands.put("getmachineid", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Returns the connection status of the remote device.");
			cmd.put("parameters", new JSONArray("[\"uuid\"]"));
			commands.put("connectionstatus", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "Connect to a remote device. Optionally, you may pass a suggested IP Address and port number. You can also specify an access code and/or the groups you want to assign the device to. All parameters other than uuid are optional.");
			cmd.put("parameters", new JSONArray("[\"uuid\",\"addr\",\"port\",\"code\",\"groups\"]"));
			commands.put("connect", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "Disconnect from a remote device.");
			cmd.put("parameters", new JSONArray("[\"uuid\"]"));
			commands.put("disconnect", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "trusted");
			cmd.put("desc", "Send a command or http request to a remote device.<br><b>Usage:</b> http://localhost:5773/peerbot/remote/remote-universal-id/botname/cmd?param1=val1&param2=val2");
			commands.put("remote", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Execute a command or http request on the local device. Used internally by the remote command.");
			commands.put("local", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Accepts a bidirectional data stream request with the remote device if connect=true, otherwise disconnects the specified stream.");
			cmd.put("parameters", new JSONArray("[\"peer\",\"stream\",\"connect\"]"));
			commands.put("stream", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Open a websocket connection on the remote device and attach it to the given stream.");
			cmd.put("parameters", new JSONArray("[\"peer\",\"bot\",\"stream\"]"));
			commands.put("websocket", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "trusted");
			cmd.put("desc", "List all of the devices the local device knows how to connect to.");
			commands.put("connections", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("parameters", new JSONArray("[\"uuid\",\"code\"]"));
			cmd.put("desc", "Grant the permissions defined by the given access code to the given peer.");
			commands.put("accesscode", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "List all access codes for connecting to this device.");
			commands.put("accesscodes", cmd);

			cmd = new JSONObject();
			cmd.put("parameters", new JSONArray("[\"code\",\"groups\",\"delete\"]"));
			cmd.put("desc", "Define a new access code. Access code will be single-use if delete=true.");
			commands.put("addaccesscode", cmd);

			cmd = new JSONObject();
			cmd.put("parameters", new JSONArray("[\"code\"]"));
			cmd.put("desc", "Delete an existing access code.");
			commands.put("deleteaccesscode", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "Connect to a remote device. Optionally, you may pass a suggested IP Address and port number. You can also specify an access code and/or the groups you want to assign the device to. All parameters other than uuid are optional.");
			cmd.put("parameters", new JSONArray("[\"uuid\",\"addr\",\"port\",\"code\",\"groups\"]"));
			commands.put("newconnection", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "Specify whether or not this device should attempt to remain connected to the given peer.");
			cmd.put("parameters", new JSONArray("[\"uuid\",\"keepalive\"]"));
			commands.put("togglekeepalive", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "Delete an existing peer connection.");
			cmd.put("parameters", new JSONArray("[\"uuid\"]"));
			commands.put("deletepeer", cmd);
/*
			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Send a UDP packet to the peer at the given IP Address and port number.");
			cmd.put("parameters", new JSONArray("[\"uuid\",\"addr\",\"port\"]"));
			commands.put("sendpacket", cmd);
*/
			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Send the temporary file with the given ID to the requesting peer via a new stream. Returns the new stream ID.");
			cmd.put("parameters", new JSONArray("[\"id\",\"sessionid\"]"));
			commands.put("tempfile", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "Allow or disallow anonymous incoming peer connection requests.");
			cmd.put("parameters", new JSONArray("[\"allow\"]"));
			commands.put("allowanon", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Add the requesting peer to the websocket subscriptions for the given bot and channel.");
			cmd.put("parameters", new JSONArray("[\"bot\",\"channel\",\"sessionid\"]"));
			commands.put("subscribe", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Returns an error if the given peer is not responding.");
			cmd.put("parameters", new JSONArray("[\"uuid\"]"));
			commands.put("available", cmd);

			cmd = new JSONObject();
			cmd.put("groups", "anonymous");
			cmd.put("desc", "Returns the public key for the given peer.");
			cmd.put("parameters", new JSONArray("[\"uuid\"]"));
			commands.put("pubkey", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "Set the public key for the given peer.");
			cmd.put("parameters", new JSONArray("[\"uuid\",\"pub\"]"));
			commands.put("setpubkey", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "Set the read key for the given peer.");
			cmd.put("parameters", new JSONArray("[\"uuid\",\"key\"]"));
			commands.put("setreadkey", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "Get/set the list of connection brokers");
			cmd.put("parameters", new JSONArray("[\"brokers\"]"));
			commands.put("brokers", cmd);

			cmd = new JSONObject();
			cmd.put("desc", "Get the list of local IP addresses");
			commands.put("localaddresses", cmd);
		}
		catch (Exception x) { x.printStackTrace(); }
/*
		cmd = new JSONObject();
		cmd.put("groups", "anonymous");
		commands.put("relay", cmd);

		cmd = new JSONObject();
		cmd.put("groups", "anonymous");
		commands.put("packet", cmd);
*/
		return commands;
	}
	
/*	
	public String[] getCommandNames()
	{
		String[] sa = { "register","noop","lookup","listzeroconf","getpeerid","getpeerinfo","getmachineid","connectionstatus","connect","disconnect","remote","local","stream","websocket","connections","newconnection","togglekeepalive","deletepeer","sendpacket" };
		return sa;
	}
*/

	private JSONObject handleLocalAddresses(Hashtable params) throws Exception
	{
		JSONArray ll = new JSONArray();
		JSONArray sl = new JSONArray();
		Enumeration<NetworkInterface> n = NetworkInterface.getNetworkInterfaces();
		for (; n.hasMoreElements();)
		{
			NetworkInterface e = n.nextElement();
			Enumeration<InetAddress> a = e.getInetAddresses();
			for (; a.hasMoreElements();)
			{
				InetAddress addr = a.nextElement();
				if (addr.isLinkLocalAddress()) ll.put(addr.getHostAddress());
				if (addr.isSiteLocalAddress()) sl.put(addr.getHostAddress());
			}
		}
		JSONObject jo = newResponse();
		jo.put("link", ll);
		jo.put("site", sl);

		return jo;
	}

	private Object handleBrokers(Hashtable params) throws Exception
	{
		File f = new File(getRootDir(), "broker.txt");
		String b = (String)params.get("brokers");
		if (b != null)
		{
			FileWriter fw = new FileWriter(f);
			JSONObject jo = new JSONObject(b);
			Iterator<String> i = jo.keys();
			while (i.hasNext()) 
			{
				String key = i.next();
				String val = jo.getString(key);
				fw.write(key+"="+val+"\n");
			}
			fw.close();
		}
		
		JSONObject jo2 = new JSONObject();
		
		if (f.exists())
		{
			BufferedReader r = new BufferedReader(new FileReader(f));
			String oneline;
			while ((oneline = r.readLine()) != null) try
			{
				String[] sa = oneline.split("=");
				if (sa.length>1) 
				{
					String key = sa[0];
					String val = sa[1];
					jo2.put(key, val);
				}
			}
			catch (Exception x) { x.printStackTrace(); }
		}
		
		JSONObject jo = newResponse();
		jo.put("brokers", jo2);
		return jo;
	}
	
	private Object handleRelay(Hashtable params) throws Exception
	{
		String uuid = (String)params.get("uuid");
		params.put("uuid", params.get("sessionid"));
		return sendCommand(uuid, "peerbot", "packet", params);
	}
/*	
	private Object handlePacket(Hashtable params) throws Exception
	{
		String uuid = (String)params.get("uuid");
		
		byte[] ba = fromHexString((String)params.get("data"));
		ByteArrayInputStream is = new ByteArrayInputStream(ba);
		ByteArrayOutputStream os = new ByteArrayOutputStream();
		decrypt(uuid, is, os, null);
		os.flush();
		os.close();
		is.close();
		ba = os.toByteArray();
		is = new ByteArrayInputStream(ba);
		P2PMsg msg = new P2PMsg(is);
		msg.remotehost = (String)params.get("addr");
		msg.remoteport = Integer.parseInt((String)params.get("port"));
		mP2PManager.handleMsg(uuid, msg);
		
		return newResponse();
	}
*/	
	private Object handleSubscribe(Hashtable params) throws Exception
	{
		String uuid = (String)params.get("sessionid");
		String bot = (String)params.get("bot");
		String channel = (String)params.get("channel");
		
		P2PPeer p = getPeer(uuid, true, true);
		JSONObject peer = new JSONObject(p.toString());
		P2PConnection con = newStream(uuid);
		
		BotBase bb = getBot(bot);
		bb.addSubscriber(channel, peer, con);
		
		JSONObject jo = newResponse();
		jo.put("stream", con.getID());
		
		return jo;
	}
	
	private Object handleAllowAnon(Hashtable params) throws Exception
	{
		String allow = (String)params.get("allow");
		mP2PManager.setAllowAnon(allow.equals("true"));
		PROPERTIES.setProperty("allowanon", allow);
		saveSettings();
		return "OK";
	}
/*	
	private Object handleSendPacket(String cmd, Hashtable params) throws Exception 
	{
		String uuid = (String)params.get("uuid");
		String address = (String)params.get("addr");
		String addresses = (String)params.get("addresses");
		int port = Integer.parseInt((String)params.get("port"));
		
		try { mP2PManager.tickle(uuid, address, port); } catch (Exception x) { System.out.println("No tickle: "+x.getMessage()); }
		
		if (addresses != null && !addresses.equals(""))
		{
			String[] list = addresses.split(",");
//			Vector<String> v2 = new Vector();
			int i = list.length;
			while (i-->0) try { mP2PManager.tickle(uuid, list[i], port); } catch (Exception x) { System.out.println("No tickle: "+x.getMessage()); }
		}
		
		return "OK";
	}
*/
	private Object handleDeletePeer(String cmd, Hashtable params) throws Exception
	{
		String id = (String)params.get("uuid");
		mP2PManager.deletePeer(id);
		return newResponse();
	}

	private Object handleToggleKeepAlive(String cmd, Hashtable params) throws Exception
	{
		String id = (String)params.get("uuid");
		String keepalive = (String)params.get("keepalive");
		return toggleKeepAlive(id, keepalive.equals("true"));
	}
	
	public JSONObject toggleKeepAlive(String id, boolean keepalive) throws Exception
	{
		P2PPeer p = mP2PManager.getPeer(id);
		p.keepAlive(keepalive);
		mP2PManager.savePeer(p);
		
		if (p.keepAlive())
		{
			mP2PManager.connect(id);
			Hashtable<String, String> h = new Hashtable<String, String>();
			h.put("uuid", getLocalID());
			h.put("local", getLocalAddressx()); 
			h.put("port", ""+mP2PManager.getLocalPort()); 

			p.sendCommand("peerbot", "register", h);
		}
		
		return new JSONObject(p.toString());
	}

	private Object handleGetPeerInfo(Hashtable params) throws Exception 
	{
		String s = "{ \"id\": \""+getLocalID()+"\", \"name\": \""+getMachineID()+"\", \"connected\": true, \"addr\": \""+getLocalAddressx()+"\", \"port\": "+mP2PManager.getLocalPort()+", \"keepalive\": true, \"localip\": \""+getLocalAddressx()+"\", \"localid\": -1, \"remoteid\": -1 }";
		JSONObject o = new JSONObject(s);
		o.put("name", getMachineID());
		o.put("allowanon", mP2PManager.getAllowAnon());
		o.put("localaddresses", getLocalAddresses());
		return o;
	}

	private Object handleRegister(Hashtable params) throws Exception
	{
		String id = (String)params.get("uuid");
		String ip = (String)params.get("local");
		String addresses = (String)params.get("addresses");
		String port = (String)params.get("port");
		int pt = Integer.parseInt(port);
		String name = (String)params.get("name");
		P2PPeer p = mP2PManager.getPeer(id);
		boolean b = false;
		if (name != null && !p.getName().equals(name)) 
		{
			p.setName(name);
			b = true;
		}
		InetSocketAddress isa = new InetSocketAddress(ip, Integer.parseInt(port));
		p.addSocketAddress(isa);
		
		isa = p.getRemoteSocketAddress() == null || p.getRemoteSocketAddress().getAddress() == null ? null : new InetSocketAddress(p.getRemoteSocketAddress().getAddress().getHostAddress(), pt);
		if (isa != null && (p.getRemoteSocketAddress() == null || !isa.equals(p.getRemoteSocketAddress())))p.addSocketAddress(isa);
		
		if(addresses != null && !addresses.equals(""))
		{
			String[] list = addresses.split(",");
			Vector<String> v2 = new Vector();
			int i = list.length;
			while (i-->0) try
			{
				isa = new InetSocketAddress(list[i], pt);
				p.addSocketAddress(isa);
			}
			catch (Exception x) { x.printStackTrace(); }
		}
		
		if (p.getPublicKey() == null)
		{
			JSONObject jo = p.sendCommand("peerbot", "pubkey", new Hashtable());
			if (jo.getString("status").equals("ok"))
			{
				byte[] ba = fromHexString(jo.getString("msg"));
				p.setPublicKey(ba);
				b = true;
			}
		}
		
		if (b) {
			mP2PManager.savePeer(p);
			fireEvent("update", new JSONObject(p.toString()));
		}
		
		JSONObject jo = newResponse();
		jo.put("name", getMachineID());
		return jo;
	}

	private Object handleLookUp(Hashtable params) throws Exception
	{
		String id = (String)params.get("uuid");
		String ids = (String)params.get("uuids");
		JSONObject results = newResponse();
		if (id != null && id.length() == 36) try
		{
			P2PPeer p = mP2PManager.isLoaded(id) ? mP2PManager.getPeer(id) : null;
			if (p == null)
			{
				String msg = "Do not know " + id;
				throw new Exception(msg);
			}

			String addresses = "";
			for (int i=0;i<p.mKnownAddresses.size();i++) 
			{
				if (!addresses.equals("")) addresses += ",";
				addresses += p.mKnownAddresses.elementAt(i).getHostString();
			}
			
			JSONObject o = newResponse();
			o.put("uuid", id);
			o.put("addr", p.getAddress());
			o.put("port", p.getPort());
			o.put("local", p.getLocalSocketAddress() != null ? p.getLocalSocketAddress().getHostString() : p.getAddress());
			o.put("addresses", addresses);
			o.put("connected", p.isConnected());
			o.put("lastcontact", p.lastContact());
			o.put("name", p.getName());
			o.put("tcp", p.isTCP());
			o.put("relays", p.relays());

			return o;
		}
		catch (Exception x)
		{
			results.put("status", "err");
			results.put("msg", "ERROR: "+x.getMessage());
		}
		
		else			
		{
			String[] sa = ids.split(" ");
			int i = sa.length;
			while (i-->0) try 
			{
				id = sa[i];
				if (mP2PManager.hasPeer(id))
				{
					params.put("uuid", id);
					JSONObject peerdata = (JSONObject)handleLookUp(params);
					if (peerdata.getString("status").equals("ok"))
						results.put(id, peerdata);
				}
			}
			catch (Exception x) { x.printStackTrace(); }
		}
		return results;
	}

	private Object handleNOOP(Hashtable params) 
	{
		return "OK";
	}

	private Object handleNewConnection(String cmd, Hashtable params) throws Exception
	{
		String id = (String)params.get("uuid");
		if (id.length() != 36) throw new Exception("Invalid Universal ID");
		
		String addr = (String)params.get("addr");
		String code = (String)params.get("code");
		if (code == null || code.trim().equals("")) code = null;
		String groups = (String)params.get("groups");
		if (groups == null || groups.trim().equals("")) groups = null;
		String port = (String)params.get("port");
		if (port == null || port.trim().equals("")) port = "-1";
		
		if (addr != null && addr.trim().equals("")) addr = null;
		P2PPeer p = mP2PManager.getPeer(id);
		p.addSocketAddress(new InetSocketAddress(addr, Integer.parseInt(port)));
		
		p.code = code;
		if (groups != null) setGroups(id, groups);
		
		final String i = id;
		final String a = addr;
		final String n = port;
		
		setTimeout(new Runnable() 
		{
			public void run() 
			{
				try
				{
					P2PPeer p = connect(i, a, Integer.parseInt(n));
				}
				catch (Exception x) { x.printStackTrace(); }
			}
		}, "new connection", 100);

		JSONObject o = newResponse();
		o.put("data", new JSONObject(p.toString()));
				
		return o;
	}

	private Object handleSuggestAccessCode(Hashtable params) throws Exception
	{
		return uniqueSessionID();
	}
	
	private JSONObject handleAccessCode(Hashtable params) throws Exception
	{
		String uuid = (String)params.get("uuid");
		String code = (String)params.get("code");

		File f = new File(getRootDir(), "invites");
		f = new File(f, code);
		if (f.exists())
		{
			Properties p = loadProperties(f);
			String groups = p.getProperty("groups");
			String delete = p.getProperty("delete");
			
			setGroups(uuid, groups);
			
			if (delete != null && delete.equals("true")) f.delete();
			
			return newResponse();
		}
		
		throw new Exception("Invalid access code: "+code);
	}
	
	private Object handleAddAccessCode(Hashtable params) throws Exception
	{
		String code = (String)params.get("code");
		if (code.length() < 4 || !code.equals(lettersAndNumbersOnly(code))) throw new Exception("Access codes must be at least 4 characters long and consist of letters and numbers only.");
		
		String groups = (String)params.get("groups");
		if (groups.equals("")) throw new Exception("You must specify at least one group");
		
		File f = new File(getRootDir(), "invites");
		f.mkdirs();
		f = new File(f, code);
		Properties p = new Properties();
		p.setProperty("delete", (String)params.get("delete"));
		p.setProperty("groups", groups);
		storeProperties(p, f);
		return "OK";
	}
	
	private Object handleDeleteAccessCode(Hashtable params) throws Exception
	{
		File f = new File(getRootDir(), "invites");
		f = new File(f, (String)params.get("code"));
		f.delete();
		return "OK";
	}
	
	private Object handleAccessCodes(Hashtable params) throws Exception
	{
		File f = new File(getRootDir(), "invites");
		f.mkdirs();
		String[] codes = f.list(new NoDotFilter());
		int i = codes.length;
		JSONObject jo = new JSONObject();
		while (i-->0)
		{
			JSONObject code = new JSONObject(loadProperties(new File(f, codes[i])));
			jo.put(codes[i], code);
		}
		JSONObject out = newResponse();
		out.put("data", jo);
		return out;
	}
	
	public Object handleConnections(Hashtable params) throws Exception
	{
		JSONObject result = newResponse();
		JSONObject ja = connections();
		result.put("data", ja);
		result.put("currenttimemillis", System.currentTimeMillis());
		return result;
	}

	public JSONArray knownPeers() throws Exception
	{
		JSONArray ja = new JSONArray();

		NoDotFilter ndf = new NoDotFilter();
		File f = new File(getRootDir(), "peers");
		f.mkdirs();
		
		String[] list = f.list(ndf);
		int n = list.length;
		for (int i=0;i<n;i++)
		{
			File f1 = new File(f, list[i]);
			if (f1.isDirectory())
			{
				String[] l1 = f1.list(ndf);
				int n1 = l1.length;
				for (int i1=0; i1<n1; i1++)
				{
					File f2 = new File(f1, l1[i1]);
					if (f2.isDirectory())
					{
						String[] l2 = f2.list(ndf);
						int n2 = l2.length;
						for (int i2=0;i2<n2;i2++)
						{
							File f3 = new File(f2, l2[i2]);
							if (f3.isDirectory())
							{
								String[] l3 = f3.list(ndf);
								int len = l3.length;
								for (int index=0; index<len; index++)
								{
									String id = l3[index];
									if (!id.equals(mP2PManager.getLocalID()))
									{
										if (mP2PManager.isLoaded(id))
										{
											ja.put(id);
										}
									}
								}
							}
						}
					}
				}
			}
		}
		return ja;
	}
	
	public JSONObject connections() throws Exception
	{
		JSONObject ja = new JSONObject();

		NoDotFilter ndf = new NoDotFilter();
		File f = new File(getRootDir(), "peers");
		f.mkdirs();
		
		String[] list = f.list(ndf);
		int n = list.length;
		for (int i=0;i<n;i++)
		{
			File f1 = new File(f, list[i]);
			if (f1.isDirectory())
			{
				String[] l1 = f1.list(ndf);
				int n1 = l1.length;
				for (int i1=0; i1<n1; i1++)
				{
					File f2 = new File(f1, l1[i1]);
					if (f2.isDirectory())
					{
						String[] l2 = f2.list(ndf);
						int n2 = l2.length;
						for (int i2=0;i2<n2;i2++)
						{
							File f3 = new File(f2, l2[i2]);
							if (f3.isDirectory())
							{
								String[] l3 = f3.list(ndf);
								int len = l3.length;
								for (int index=0; index<len; index++)
								{
									String id = l3[index];
									if (!id.equals(mP2PManager.getLocalID()))
									{
										if (mP2PManager.isLoaded(id))
										{
											JSONObject jo = new JSONObject((mP2PManager.getPeer(id).toString()));
											jo.put("id", id);
											ja.put(id, jo);
										}
									}
								}
							}
						}
					}
				}
			}
		}
		return ja;
	}

	private Object handleWebsocket(String cmd, Hashtable params) throws Exception 
	{
		String peerid = (String)params.get("peer");
		String bot = (String)params.get("bot");
		Long conid = Long.parseLong((String)params.get("stream"));
		P2PPeer p = mP2PManager.getPeer(peerid);
		P2PConnection con = p.getStream(conid);
		
		BotBase b = (BotBase)mBots.get(bot);
		b.webSocketConnect(new WebSocket(con), cmd);
		
		return "OK";
	}

	private Object handleStream(String cmd, Hashtable params) throws Exception
	{
		String id = (String)params.get("peer");
		P2PPeer peer = mP2PManager.getPeer(id);
		long stream = Long.parseLong((String)params.get("stream"));
		boolean connect = params.get("connect").equals("true");
		if (connect)
		{
			P2PConnection con = new P2PConnection(peer, stream);
			peer.accept(con);
		}
		else
		{
			peer.remove(stream);
		}
		
		return "OK";
	}

	private Object handleLocal(final String cmd, Hashtable params) throws Exception 
	{
		// FIXME - thread this and return null like remote
		
		P2PPeer p = mP2PManager.getPeer((String)params.get("peer"));
		long id = Long.parseLong((String)params.get("stream"));
		System.out.println("Handling request local via stream "+id);
		final P2PConnection con = p.getStream(id);
		final OutputStream os = con.getOutputStream();

		String u = (String)params.get("url");
		JSONObject o = new JSONObject((String)params.get("params"));
		String sid = (String)params.get("sessionid");
		if (sid != null) o.put("sessionid", sid);
		
		if (o.has("FILEUPDLOAD"))
		{
			String fu = o.getString("FILEUPDLOAD");
			fu = fu.substring(fu.lastIndexOf('\\')+1);
			fu = fu.substring(fu.lastIndexOf('/')+1);
			fu = getUploadedFile(sid, fu);
			o.put("FILEUPDLOAD", fu);
		}
		
		Iterator e = o.keys();
		params = new Hashtable();
		while (e.hasNext()) 
		{
			String key = (String)e.next();
			params.put(key, o.getString(key));
		}
		
		InputStream is;
		long n = -1;
		
//		File f = null;
		JSONObject reshead = new JSONObject();
		String rh2 = "";
		int i = u.indexOf('/');
		if (i != -1 && o.has("request_headers"))
		{
			String h = (String)o.get("request_headers");
			o = new JSONObject(h);
			Hashtable<String, Object> headers = new Hashtable();
			Iterator it = o.keys();
			while (it.hasNext())
			{
				String key = (String)it.next();
				headers.put(key,  o.get(key));
			}

			String method = (String)headers.get("METHOD");
			params.put("request_output_stream", os);
			is = HTTP.handleCommand(method, headers, params, u);
			is = new BufferedInputStream(is);
			while (true)
			{
				String l = readLine(is, 4096);
				if (l.trim().equals("")) break;
				if (l.toLowerCase().startsWith("content-length:")) n = Long.parseLong(l.substring(l.indexOf(':')+1).trim());
				
				int x = l.indexOf(':');
				if (x>0){
					String key = l.substring(0,x).trim();
					String val = l.substring(x+1).trim();
					if (key.equals("content-length")) n = Long.parseLong(val);
					reshead.put(key, val);
					rh2+="\r\n"+key+": "+val;
				}
			}
		}
		else
		{
			String s = "http://"+SYS.getLoopbackAddress().getHostAddress()+":"+mMasterBot.getPortNum()+"/"+u;
			URL url = new URL(s);
			final URLConnection uc = url.openConnection();
			n = uc.getContentLength();
			is = uc.getInputStream();
		}
		
		final InputStream iis = is;
//		final File ff = f;
		Runnable r = new Runnable() 
		{
			public void run() 
			{
				try
				{
					sendData(iis, os, -1, 4096);
					iis.close();
					os.flush();
					os.close();
//					if (ff != null) ff.delete();
				}
				catch (Exception x) { x.printStackTrace(); }

// FIXME?
//				con.disconnect();
				System.out.println("Local send "+cmd);
			}
		};
		addJob(r, "P2P send local");
		JSONObject jo = newResponse();
		jo.put("msg",""+n);
		jo.put("RESHEAD", reshead);
		jo.put("R-HEAD", rh2);
		return jo;
	}

	private Object handleTempfile(String cmd, Hashtable params) throws Exception 
	{
		String sid = (String)params.get("sessionid");
		String id = (String)params.get("id");
		final File f = getTempFile(id);
		final int len = (int)f.length();
		final P2PConnection con = mP2PManager.getPeer(sid).newStream();
		long stream = con.getID();
		
		JSONObject o = newResponse();
		o.put("stream", stream);
		o.put("len", len);
		
		Runnable r = new Runnable() 
		{
			public void run() 
			{
				try
				{
					FileInputStream fis = new FileInputStream(f);
					OutputStream os = con.getOutputStream();
					sendData(fis, os, len, 4096);
					os.flush();
					os.close();
					fis.close();
				}
				catch (Exception x) { x.printStackTrace(); }
			}
		};
		addJob(r, "P2P sending temp file");
		
		return o;
	}

	public String getUploadedFile(String sid, String fu) throws Exception
	{
		Hashtable p = new Hashtable();
		p.put("id", fu);
		JSONObject o = sendCommand(sid, "peerbot", "tempfile", p);
		Long stream = o.getLong("stream");
		int len = o.getInt("len");
		P2PConnection con = mP2PManager.getPeer(sid).getStream(stream);
		InputStream is = con.getInputStream();
		File f = newTempFile();
		FileOutputStream fos = new FileOutputStream(f);
		sendData(is, fos, len, 4096);
		fos.flush();
		fos.close();
		is.close();
		con.close();
		
		return f.getCanonicalPath();
	}

	private Object handleRemote(String cmd, Hashtable params) throws Exception 
	{
		final String c = cmd;

		JSONObject o = new JSONObject(params);
		cmd = cmd.substring(cmd.indexOf('/')+1);
		int i = cmd.indexOf('/');
		String peer = cmd.substring(0, i);
		cmd = cmd.substring(i+1);

		P2PPeer p = mP2PManager.getPeer(peer);
		
		if (!p.isConnected()) 
		{
			System.out.println("WAITING FOR CONNECT ON STREAM TO "+p.getName()+"/"+p.getID());
			
			mP2PManager.connect(p.getID());
			
			final Hashtable h = params;
			setTimeout(new Runnable() {
				
				@Override
				public void run() 
				{
					try { handleRemote(c, h); } catch (Exception x) { x.printStackTrace(); }
				}
			}, "WAITING FOR CONNECT ON STREAM TO "+p.getName()+"/"+p.getID(), 500);
			
			return null;
		}
		
		P2PConnection con = p.newStream();

		final OutputStream os = (OutputStream)params.get("request_output_stream");

		params = new Hashtable();
		params.put("url", cmd);
		params.put("peer", mP2PManager.getLocalID());
		params.put("stream", ""+con.getID());
		params.put("params", ""+o);
		
		final InputStream is = con.getInputStream();
		final String command = cmd;
		
		P2PCallback cb = new P2PCallback() 
		{
			public P2PCommand execute(JSONObject o) 
			{
				try {
					if (o.getString("status").equals("ok")) {
						int len = o.getInt("msg");

						String m = HTTP.getMIMEType(command);
						if (m == null) m = "text/html";
						String headers = o.getString("R-HEAD");
						int i = headers.indexOf("Set-Cookie");
						if (i != -1)
							headers = headers.substring(0, i) + "Do-Not-" + headers.substring(i);

						String look = "\r\nContent-Length: ";
						int off = headers.indexOf(look);
						int off2 = headers.indexOf('\r', off + 2);
						if (off2 == -1) off2 = headers.length();
						int len2 = off == -1 ? -1 : Integer.parseInt(headers.substring(off + look.length(), off2));

						if (len != len2)
							System.out.println("WHAT? " + len2 + " OF " + len + " bytes!!!");


						try {
							String res = headers.indexOf("\r\nContent-Range: ") == -1 ? "200 OK" : "206 Partial Content";
							byte[] ba = ("HTTP/1.1 " + res + headers + "\r\n\r\n").getBytes();
							InputStream is2 = new ByteArrayInputStream(ba);
							InputStream sis = new HTTPResponse(is, is2, len, -1, -1);

							len += ba.length;

							long n = sendData(sis, os, len, 4096);
							if (n != len)
								System.out.println("ONLY SENT " + n + " OF " + len + " bytes!!!");
						} catch (Exception x) {
							x.printStackTrace();
						}

						try {
							os.flush();
						} catch (Exception x) {
							x.printStackTrace();
						}
						try {
							os.close();
						} catch (Exception x) {
							x.printStackTrace();
						}
						try {
							is.close();
						} catch (Exception x) {
							x.printStackTrace();
						}
					} else {
						// FIXME;
						System.out.println("FIXME");
					}
				}
				catch (Exception x) { x.printStackTrace(); }

				return null;
			}
		};
		
		sendCommandAsync(peer, "peerbot", "local", params, cb);
		
		return null;
	}

	public JSONObject sendCommand(String id, String bot, String cmd, Hashtable params) throws Exception 
	{
		P2PPeer peer = mP2PManager.getPeer(id);
		return peer.sendCommand(bot, cmd, params);
	}

	public JSONObject sendCommand(String id, String bot, String cmd, Hashtable params, long millis) throws Exception
	{
		P2PPeer peer = mP2PManager.getPeer(id);
		return peer.sendCommand(bot, cmd, params, millis);
	}

	public void sendCommandAsync(String id, String bot, String cmd, Hashtable params, P2PCallback cb) throws Exception
	{
		P2PPeer peer = mP2PManager.getPeer(id);
		peer.sendCommandAsync(bot, cmd, params, cb);
	}

	private String handleConnect(Hashtable params) throws Exception
	{
		String uuid = (String)params.get("uuid");
		final String code = (String)params.get("code");
		String groups = (String)params.get("groups");
		String address = (String)params.get("addr");
		int port = address == null ? -1 : Integer.parseInt((String)params.get("port"));
		
		final P2PPeer p = connect(uuid, address, port);
		p.code = code;
		
		if (code != null) addPeriodicTask(new PeriodicTask(100, true, "send access code") 
		{
			@Override
			public void run() {
				if (p.isConnected()) try 
				{ 
					Hashtable<String, String> params = new Hashtable();
					params.put("uuid", getLocalID());
					params.put("code", code);
					System.out.println("SENDING ACCESS CODE TO "+p);
					JSONObject jo = p.sendCommand("peerbot", "accesscode", params);
					mRepeat = false;
					System.out.println("SENT ACCESS CODE TO "+p.getID()+": "+jo);
				}
				catch (Exception x) { x.printStackTrace(); }
			}
		});
		
		if (groups != null) setGroups(uuid, groups);
		
		return "OK";
	}
	
	private void setGroups(String uuid, String groups) throws Exception
	{
		Hashtable<String, String> h = new Hashtable();
		h.put("username",  uuid);
		h.put("groups", groups);
		getBot("securitybot").handleCommand("newuser", h);
	}

	private P2PPeer connect(String uuid, String address, int port) throws Exception
	{
		P2PPeer peer = mP2PManager.connect(uuid, address, port);
		if (peer == null) throw new Exception("Unable to connect to peer (timeout)");
//		peer.sendCommand("peerbot", "noop", new Hashtable<String,String>());
		
		return peer;
	}

	private String handleDisconnect(Hashtable params) throws Exception
	{
		String uuid = (String)params.get("uuid");
		mP2PManager.disconnect(uuid);
		
		return "OK";
	}

	private String handleConnectionStatus(Hashtable params) throws Exception
	{
		String uuid = (String)params.get("uuid");
		P2PPeer peer = getPeer(uuid, false, false);
		if (peer != null && peer.isConnected()) return "OK";

		return "NOT CONNECTED";
	}

	private String handleGetPeerID(Hashtable params) 
	{
		return mP2PManager.getLocalID();
	}

	private String handleGetMachineID(Hashtable params) 
	{
		return getMachineID();
	}

	private JSONObject handleListZeroConf(Hashtable params) throws Exception
	{
		return (JSONObject)mMasterBot.handleCommand("discover", params);
	}

	public String getServiceName() 
	{
		return "peerbot";
	}

	/**
	 * @param args
	 */
	public static void main(String[] args) 
	{
		try { new PeerBot().start(); } catch (Exception x) { x.printStackTrace(); }
	}

	public String handleShutdown(Hashtable params) throws Exception 
	{
		try { mP2PManager.stop(); } catch (Exception x) { x.printStackTrace(); }
		return super.handleShutdown(params);
	}

	public JSONObject getLocalAddresses() throws Exception
	{
		return handleLocalAddresses(new Hashtable());
	}

	public static String getLocalAddressx() throws IOException
	{
		String ad = null;
//		try 
//		{ 
//			ad = InetAddress.getLocalHost().getHostAddress(); 
//		} 
//		catch (Exception x) 
//		{
//			try { ad = InetAddress.getByName(null).getHostAddress(); } catch (Exception x2) {}
//		}
		
		
		String sl = null;
		String ll = null;
        Enumeration<NetworkInterface> n = NetworkInterface.getNetworkInterfaces();
        for (; n.hasMoreElements();)
        {
            NetworkInterface e = n.nextElement();
            Enumeration<InetAddress> a = e.getInetAddresses();
            for (; a.hasMoreElements();)
            {
                InetAddress addr = a.nextElement();
                if (addr.isLinkLocalAddress()) ll = addr.getHostAddress();
                if (addr.isSiteLocalAddress()) sl = addr.getHostAddress();
/*                if (addr.isLinkLocalAddress() || addr.isSiteLocalAddress())
                {
	                String s = addr.getHostAddress();
	                if (s.indexOf('.') != -1 && !s.startsWith("127.") && !s.startsWith("0.")) ad = s;
                }
*/
            }
        }
        
        if (sl != null) return sl;
        if (ll != null) return ll;
        
        if (ad == null) ad = "127.0.0.1"; 
        
        return ad;
	}

	public void init() throws Exception 
	{
		super.init();
		
		addNumThreads(NUMPEERBOTTHREADS); // For "local" and "tempfile" commands as well as remote execution of commands and callbacks
		
		try
		{
//			String providerName = null; 
	        Provider[] providers = Security.getProviders();
	        File r = getRootDir();
	        r.mkdirs();
	        
	        PrintStream ps = new PrintStream(new File(r, "crypto.log"));
	        
	        for(int i = 0; i < providers.length; i++) 
	        { 
	            Provider p = providers[i]; 
	            ps.println("Provider: " + p); 
	            ps.println("==============================="); 
	            ps.println("provider properties:"); 
	            ArrayList keys = new ArrayList(p.keySet()); 
	            Collections.sort(keys); 
	            String key; 
	            for(Iterator j = keys.iterator(); j.hasNext(); 
	ps.println(key + "=" + p.get(key))) 
	                key = (String)j.next(); 
	
	            ps.println("-------------------------------"); 
	        } 
	        
	        ps.flush();
	        ps.close();
		}
		catch (Exception x) { x.printStackTrace(); }
		
		if (PROPERTIES.get("uuid") == null)
		{
			PROPERTIES.setProperty("uuid", UUID.randomUUID().toString());
			saveSettings();
		}
		
		String aa = PROPERTIES.getProperty("allowanon");
		if (aa == null) aa = "false";
		
		String p = PROPERTIES.getProperty("udpport");
		if (p == null) p = "0";
		
		String ad = PROPERTIES.getProperty("localaddress"); // Sometimes you just have to hard code it in the properties file
		if (ad == null) ad = getLocalAddressx();
		
		String s = PROPERTIES.getProperty("privatekey");
		if (s == null)
		{
			KeyPair kp = SuperSimpleCipher.generateKeyPair();
			byte[] prk = kp.getPrivate().getEncoded();
			byte[] pbk = kp.getPublic().getEncoded();
			PROPERTIES.setProperty("privatekey", toHexString(prk));
			PROPERTIES.setProperty("publickey", toHexString(pbk));
			saveSettings();
		}
		
		File f = new File(getRootDir(), "peers");
		f.mkdirs();
		
		mP2PManager = new P2PManager(this, PROPERTIES.getProperty("uuid"),Integer.parseInt(p), getPrivateKey(), getPublicKey());
		mP2PManager.setAllowAnon(aa.equals("true"));

		s = PROPERTIES.getProperty("peers");
		if (s != null)
		{
			PROPERTIES.remove("peers");
			saveSettings();
		}

		addJob(new Runnable() {
			@Override
			public void run() {
				while (!mMasterBot.RUNNING)
				{
					try { Thread.sleep(100); } catch (Exception x) { x.printStackTrace(); }
				}
				try { postInit(); } catch (Exception x) { x.printStackTrace(); }
			}
		});
	}

	private void postInit() throws Exception {
		mP2PManager.start();

//		if (p.equals("0") || p.equals("-1"))
//		{
//			int pp = mP2PManager.getLocalPort();
//			PROPERTIES.setProperty("udpport", ""+pp);
//			saveSettings();
//		}

//		initPeers(new File(getRootDir(), "peers"));

		if (hasData("runtime", "peerbot_mypeers")) try
		{
			JSONArray l = getData("runtime", "peerbot_mypeers").getJSONObject("data").getJSONArray("list");
			int i = l.length();
			while (i-->0)
				try { mP2PManager.getPeer(l.getString(i)); }
				catch (Exception x) { x.printStackTrace(); }
		}
		catch (Exception x) { x.printStackTrace(); }

		addPeriodicTask(new PeriodicTask(5000, true, "check brokers")
		{
			@Override
			public void run()
			{
				checkBrokers();
			}
		});

	}
	
	private void checkBrokers() 
	{
		try
		{
			File f = new File(getRootDir(), "broker.txt");
			if (f.exists())
			{
				BufferedReader r = new BufferedReader(new FileReader(f));
				String oneline;
				while ((oneline = r.readLine()) != null) try
				{
					String[] sa = oneline.split("=");
					if (sa.length>1) 
					{
						String uuid = sa[0];
						P2PPeer p = mP2PManager.getPeer(uuid);
						if (!p.isTCP()) 
						{
							sa = sa[1].split(":");
							String addr = sa[0];
							int port = Integer.parseInt(sa[1]);
							mP2PManager.initiateTCPConnection(p, new InetSocketAddress(addr, port));
						}
					}					
				}
				catch (Exception x)
				{
					System.out.println("Error connecting to broker at "+oneline);
					x.printStackTrace();
				}
				r.close();
			}
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	private void initPeersx(File f) 
	{
		if (f.isDirectory())
		{
			String[] sa = f.list(new NoDotFilter());
			int i = sa.length;
			while (i-->0) initPeersx(new File(f, sa[i]));
			if (f.list(new NoDotFilter()).length == 0) deleteDir(f);
		}
		else try
		{
			Properties p = loadProperties(f);
			if (p != null && p.getProperty("readkey") == null) f.delete();
			else if (p != null && p.getProperty("keepalive").equals("true")) mP2PManager.getPeer(f.getName());
			
//			P2PPeer p = getPeer(f.getName(), true, false);
//			if (p != null && p.getReadKey() == null) f.delete();
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	public byte[] getPrivateKey()
	{
		String s = PROPERTIES.getProperty("privatekey");
		return fromHexString(s);
	}

	public byte[] getPublicKey()
	{
		String s = PROPERTIES.getProperty("publickey");
		return fromHexString(s);
	}

	public void webSocketConnect(final WebSocket sock, String cmd) throws Exception
	{
		if (cmd.startsWith("remote/"))
		{
			int i = cmd.indexOf('/');
			cmd = cmd.substring(i+1);
			i = cmd.indexOf('/');
			String id = cmd.substring(0,i);
			cmd = cmd.substring(i+1);
			i = cmd.indexOf('/');
			String bot = cmd.substring(0,i);
			cmd = cmd.substring(i+1);
			P2PPeer peer = mP2PManager.getPeer(id);
			P2PConnection con = peer.newStream();
			mRemoteWebSockets.put(sock, con);
			Hashtable<String, String> params = new Hashtable<String, String>();
			params.put("peer", ""+mP2PManager.getLocalID());
			params.put("stream", ""+con.getID());
			params.put("connect", "true");
			params.put("bot", bot);
			sendCommand(id, "peerbot", "websocket", params);

			new PipeStreamer(this, sock.getInputStream(), con.getOutputStream(), "Remote websocket SEND");
			new PipeStreamer(this, con.getInputStream(), sock.getOutputStream(), "Remote websocket RECEIVE");
		}
		else
			super.webSocketConnect(sock, cmd);
	}
	
	public void webSocketMessage(WebSocket sock, String msg) throws Exception
	{
		P2PConnection con = mRemoteWebSockets.get(sock);
		if (con != null) try
		{
			byte[] ba = msg.getBytes();
			OutputStream os = con.getOutputStream();
			os.write(0);
			os.write(longToBytes(ba.length));
			os.write(ba);
			os.flush();
		}
		catch (Exception x) { x.printStackTrace(); }
		else super.webSocketMessage(sock, msg);
	}
		
	public void webSocketMessage(WebSocket sock, byte[] ba, String cmd)
	{
		P2PConnection con = mRemoteWebSockets.get(sock);
		if (con != null) try
		{
			OutputStream os = con.getOutputStream();
			os.write(1);
			os.write(longToBytes(ba.length));
			os.write(ba);
			os.flush();
		}
		catch (Exception x) { x.printStackTrace(); }
		else super.webSocketMessage(sock, ba);
	}

	public void websocketClose(WebSocket sock)
	{
		P2PConnection sock2 = mRemoteWebSockets.get(sock);
		if (sock2 != null) 
			try { sock2.close(); } catch (Exception x) { x.printStackTrace(); }
		super.websocketClose(sock);
	}

//	public Enumeration<P2PPeer> getConnections() 
//	{
//		return mP2PManager.getConnections();
//	}

	public String getLocalID() 
	{
		return mP2PManager == null ? null : mP2PManager.getLocalID();
	}

	public static PeerBot getPeerBot() 
	{
		return (PeerBot)getBot("peerbot");
	}
	
	public P2PPeer getPeer(String id) throws Exception 
	{
		return mP2PManager.getPeer(id);
	}

	public P2PPeer getPeer(String id, boolean load, boolean create) throws Exception 
	{
		// NOTE: LOAD IS IGNORED
		P2PPeer p = mP2PManager.hasPeer(id) || create ? mP2PManager.getPeer(id) : null;
		
		return p;
	}

	public void fireEvent(String event, JSONObject data) 
	{
		System.out.println("FIRING EVENT: "+event+" "+data);
		super.fireEvent(event, data);
		JSONObject o = new JSONObject();
		try 
		{ 
			o.put("event", event);
			o.put("data", data);
			sendWebsocketMessage(o.toString()); 
		} 
		catch (Exception x) { x.printStackTrace(); }
	}
	
	public P2PConnection newStream(String uuid) throws Exception
	{
		return getPeer(uuid, true, true).newStream();
	}
	
	public P2PConnection getStream(String uuid, long id) throws Exception
	{
		return getPeer(uuid, true, true).getStream(id);
	}
	
	private boolean handleAvailable(Hashtable params) throws Exception
	{
		String uuid = (String)params.get("uuid");
		return mP2PManager.available(uuid);
	}
	
	private String handlePubKey(Hashtable params) throws Exception
	{
		String uuid = (String)params.get("uuid");
		System.out.println("Looking up pubkey for "+uuid);
		if (uuid != null)
		{
			P2PPeer p = getPeer(uuid, true, true);
			if (p != null)
			{
				byte[] ba = p.getPublicKey();
				if (ba == null) 
				{
					// FIXME - Only ask connection brokers. Also, do something to prevent nigh-unto-infinite recursion.
					Iterator<P2PPeer> i = getConnections();
					while (i.hasNext())
					{
						P2PPeer p2 = i.next();
						if (p2.isConnected() && !p2.getID().equals(uuid)) try
						{
							JSONObject jo = sendCommand(p2.getID(), "peerbot", "pubkey", params);
							if (jo.getString("status").equals("ok")) 
							{
								String pubkey = jo.getString("msg");
								p.setPublicKey(fromHexString(pubkey));
								mP2PManager.savePeer(p);
								return pubkey;
							}
						}
						catch (Exception x) { x.printStackTrace(); }
					}
					
					JSONObject jo = sendCommand(uuid, "peerbot", "pubkey", params);
					if (jo.getString("status").equals("ok")) 
					{
						String pubkey = jo.getString("msg");
						p.setPublicKey(fromHexString(pubkey));
						mP2PManager.savePeer(p);
						return pubkey;
					}
				}
				else return toHexString(ba);
			}
			
			throw new Exception("Do not have public key for: "+uuid);
		}
			
		return toHexString(getPublicKey());
	}

	private String handleSetPubKey(Hashtable params) throws Exception
	{
		String uuid = (String)params.get("uuid");
		P2PPeer p = getPeer(uuid, true, true);
		byte[] ba = fromHexString((String)params.get("pub"));
		p.setPublicKey(ba);
		mP2PManager.savePeer(p);
		return "OK";
	}

	private String handleSetReadKey(Hashtable params) throws Exception
	{
		String uuid = (String)params.get("uuid");
		P2PPeer p = getPeer(uuid, true, true);
		byte[] ba = fromHexString((String)params.get("key"));
		p.setReadKey(ba);
		mP2PManager.savePeer(p);
		return "OK";
	}

	public Iterator<P2PPeer> getConnections() 
	{
		return mP2PManager.connected();
	}

	public void update(JSONArray ja) 
	{
		int i = ja.length();
		while (i-->0) try
		{
			JSONObject p = (JSONObject)ja.get(i);
			String uuid = p.getString("uuid");
			if (mP2PManager.hasPeer(uuid))
			{
				P2PPeer peer = mP2PManager.getPeer(uuid);
				peer.setName(p.getString("name"));
				
				if (p.has("peerinfo"))
				{
					int port = p.getJSONObject("peerinfo").getInt("port");
					if (peer.getPort() == -1) peer.setPort(port);
				}
				
				int port = peer.getPort();
				if (port != -1)
				{
					JSONArray addr = p.getJSONArray("address");
					int j = addr.length();
					while (j-->0)
					{
						String address = addr.getString(j);
						mP2PManager.addInetSocketAddress(uuid, new InetSocketAddress(address, port));
					}
				}
			}
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	public static boolean hasPeer(String id) 
	{
		return mP2PManager.hasPeer(id);
	}

	public JSONArray myPeers()
	{
		try
		{
			return getData("runtime", "peerbot_mypeers").getJSONObject("data").getJSONArray("list");
		}
		catch (Exception x) { return new JSONArray(); }
	}
}
