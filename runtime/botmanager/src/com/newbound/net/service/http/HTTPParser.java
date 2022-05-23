package com.newbound.net.service.http;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Hashtable;
import java.util.Vector;

import org.json.JSONObject;

import com.newbound.net.mime.MIMEMultipart;
import com.newbound.net.service.Parser;
import com.newbound.net.service.Request;
import com.newbound.net.service.Response;
import com.newbound.net.service.Service;
import com.newbound.net.service.Socket;
import com.newbound.net.service.SocketClosedException;
import com.newbound.robot.BotUtil;
import com.newbound.robot.Callback;

public class HTTPParser extends BotUtil implements Parser 
{
	Socket s = null;
	InputStream is = null;
	OutputStream os = null;

	public HTTPParser() 
	{
		super();
	}

	@Override
	public boolean init(Service service, Socket sock) throws Exception 
	{
		s = sock;
		is = new BufferedInputStream(sock.getInputStream());
		os = sock.getOutputStream();

		return true;
	}

	@Override
	public Request parse() throws Exception 
	{
		String oneline = readLine(is, 4096*64);
		
		Hashtable<String, Object> headers = parseHeaders();
		
		int i = oneline.indexOf(' ')+2;
		int j = oneline.indexOf(' ', i);
		
		String method = oneline.substring(0, i-2).toUpperCase();
		String protocol = oneline.substring(j+1);
		oneline = oneline.substring(i,j);
		String querystring = "";
		
		Hashtable params = new Hashtable();
		
		if (method.equals("POST")) extractPOSTParams(params, headers);

		String cmd;
		i = oneline.indexOf('?');
		if (i != -1)
		{
			cmd = oneline.substring(0,i);
			querystring = oneline.substring(i+1);
			addParams(params, querystring);
		}
		else cmd = oneline;
		
		String loc = s.getRemoteSocketAddress() == null ? "unknown" : s.getRemoteSocketAddress().toString();

		return new HTTPRequest(protocol, method, cmd, headers, params, loc);
	}
	
	protected void extractPOSTParams(Hashtable params, Hashtable headers) throws IOException 
    {
        String clstr = (String)headers.get("CONTENT-LENGTH");
        String ctstr = (String)headers.get("CONTENT-TYPE");
        int max = -1;
        try { max = Integer.parseInt(clstr); } catch (Exception x)
        {
        	x.printStackTrace();
        }
        	        
        int i;
        if (ctstr != null && ctstr.toLowerCase().startsWith("multipart/"))
        {

        		i = ctstr.indexOf("boundary=");
        		if (i != -1)
        		{
        			File f = getTempFile(uniqueSessionID());
	        		String b = ctstr.substring(i+9);
	        		MIMEMultipart mm = new MIMEMultipart(is, b, headers, f);
	    	        Enumeration e = mm.getData().elements();
	    	        while (e.hasMoreElements()) 
	    	       	{
	    	       		Object o = e.nextElement();
	    		        loadParams(o, params);
	    	       	}
	    	        deleteDir(f);
        		}
        }
        else while (max > 0)
        {
	        String key = "";
	        String value = "";

	        while ((max-->0) && ((i = is.read())!='=')) key += (char)i;
	        while ((max-->0) && ((i = is.read())!='&')) value += (char)i;
	        
	        key = key.replace('+',' ');
	        value = value.replace('+',' ');
	        
	        key = hexDecode(key);
	        value = hexDecode(value);
	        
	        params.put(key, value);
        }
	}

	protected void loadParams(Object o, Hashtable params)
	{
		if (o instanceof MIMEMultipart)
		{
			MIMEMultipart mm = (MIMEMultipart)o;
			Enumeration types = mm.getHeaders().keys();
			Enumeration keys = mm.getHeaders().elements();
			Enumeration values = mm.getData().elements();
			
			while (keys.hasMoreElements())
			{
				String key = (String)keys.nextElement();
				String keytype = (String)types.nextElement();
				
				if (keytype.equals("CONTENT-DISPOSITION"))
				{
					Object o2 = values.nextElement();
					if (o2 instanceof File)
					{
						try 
						{ 
							File f = (File)o2;
							File f2 = getTempFile(uuid());
							copyFile(f, f2);
//							System.out.println("FILEUPDLOAD "+f.getCanonicalPath()+" "+f.exists()+" "+f.length());
							params.put("FILEUPDLOAD", f2.getCanonicalPath()); 
						}
						catch (Exception x) { x.printStackTrace(); } 
					}
					else if (o2 instanceof byte[])
					{
						String value = new String((byte[])o2).trim();
						
						// System.out.println(key+" - "+value);
						
						if (key.startsWith("form-data"))
						{
							int i = key.indexOf("name=\"") + 6;
							int j = key.indexOf("\"", i);
							
							key = key.substring(i,j);
							params.put(key, value);
System.out.println("POST: "+key+": "+value);
						}
					}
					else
					{
						String value = new String((char[])o2).trim();
						
						// System.out.println(key+" - "+value);
						
						if (key.startsWith("form-data"))
						{
							int i = key.indexOf("name=\"") + 6;
							int j = key.indexOf("\"", i);
							
							key = key.substring(i,j);
							params.put(key, value);
System.out.println("POST: "+key+": "+value);
						}
					}
					
				}
				else if (keytype.equals("CONTENT-TYPE"))
				{
					System.out.println("WE GOT CONTENT-TYPE");
				}
				
				
			}
		}
		else if (o instanceof File) loadParams((File)o, params);
		else loadParams(""+o, params);
	}

	protected void loadParams(File f, Hashtable params)
	{
	    try
	    {
		    ByteArrayOutputStream baos = new ByteArrayOutputStream();
		    FileReader fr = new FileReader(f);
		    int i = 0;
		    while ((i = fr.read()) != -1) baos.write(i);
		    fr.close();
		    baos.close();
		    loadParams(baos.toString(), params);
	    }
	    catch (Exception x) { x.printStackTrace(); }
	}
	
	protected void loadParams(String s, Hashtable params)
	{
		s = s.trim();
		
		s = s.replace("+", " ");

		String[] paramList = s.split("&");
		String[] paramPair;
		int i = paramList.length;
		
		while (i-->0)
		{
			paramPair = paramList[i].split("=");
			if (paramPair.length > 1) params.put(hexDecode((String)paramPair[0]), hexDecode((String)paramPair[1]));
//System.out.println("POST: "+paramPair.elementAt(0)+": "+paramPair.elementAt(1));
		}
	}

	private void addParams(Hashtable params, String oneline)
	{
		int i;
		while ((i=oneline.indexOf('&')) != -1)
		{
			String oneparam = hexDecode(oneline.substring(0,i));
			oneline = oneline.substring(i+1);
			addParam(params, oneparam);
		}
		addParam(params, hexDecode(oneline));
	}

	private void addParam(Hashtable params, String oneparam)
	{
		int i = oneparam.indexOf('=');
		if (i != -1)
		{
			String key = oneparam.substring(0, i);
			String val = oneparam.substring(i+1);
			params.put(key, val);
		}
	}

	private Hashtable<String, Object> parseHeaders() throws Exception 
	{
		String last = null;
		Hashtable<String, Object> headers = new Hashtable();
		
		String oneline;
		while ((oneline = readLine(is, 4096*64)) != null && !oneline.trim().equals(""))
		{
			if (!oneline.startsWith(" "))
			{
				int i = oneline.indexOf(':');
				
				if (i == -1)
					System.out.println(oneline);
				
				String key = oneline.substring(0,i).toUpperCase();
				String val = oneline.substring(i+1).trim();
				Object b = headers.get(key);
				if (b == null) headers.put(key, val);
				else
				{
					if (b instanceof Vector) ((Vector<String>)b).addElement(val);
					else
					{
						String old = (String)b;
						Vector<String> v = new Vector<String>();
						v.addElement(old);
						v.addElement(val);
						headers.put(key, v);
					}
				}
				last = key;
			}
			else
			{
				Object o = headers.get(last);
				if (o instanceof Vector) 
				{
					Vector<String> v = (Vector<String>)o;
					String old = v.remove(v.size()-1);
					old = old+"\r\n"+oneline;
					v.addElement(old);
				}
				else
				{
					String v = o+"\r\n"+oneline;
					headers.put(last, v);
				}
			}
		}
		
		if (oneline == null) throw new SocketClosedException();
		
		return headers;
	}

	@Override
	public void close() throws Exception 
	{
		s.close();
	}

	@Override
	public void error(Exception x) 
	{
		x.printStackTrace();
	}

	@Override
	public void execute(Request data, Callback cb) throws Exception 
	{
		cb.execute(data.getData());
	}

	@Override
	public void send(Response r) throws Exception 
	{
		HTTPResponse response = (HTTPResponse)r;
		sendData(response, os, -1, 4096);
		os.flush();
		if (!response.KEEPALIVE) s.close();
		response.close();
	}

}
