package com.newbound.net.service.http;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Enumeration;
import java.util.Hashtable;

import com.newbound.net.service.Response;

public class HTTPResponse extends InputStream implements Response
{
	public boolean KEEPALIVE = false;
	
	boolean onedone = false;
	InputStream is = null;
	InputStream is2 = null;
	public int HEADERLEN = -1;
	
	public HTTPResponse(String responsecode, Hashtable headers, InputStream a) throws IOException
	{
		this(responsecode, headers, a, -1, -1);
	}
	
	public HTTPResponse(String responsecode, Hashtable headers, InputStream a, int rangebegin, int rangeend) throws IOException
	{
		super();
		is = a;
		is2 = buildHeaders(responsecode, headers);
		if (rangebegin >0)
		{
			int n = 0;
			while (n<rangebegin) n += is.skip(rangebegin-n);
		}
	}

	private InputStream buildHeaders(String res, Hashtable headers) {
		String s = "";
		Enumeration<String> e = headers.keys();
		while (e.hasMoreElements())
		{
			String key = e.nextElement();
			String val = ""+headers.get(key);
			s += key+": "+val+"\r\n";
		}
		byte[] ba = ("HTTP/1.1 "+res+"\r\n"+s+"\r\n").getBytes();
		HEADERLEN = ba.length;
		return new ByteArrayInputStream(ba);
	}

	public int read() throws IOException 
	{
		int i = is2.read();
		if (i == -1) 
		{ 
			onedone = true;
			i = is.read(); 
		}
		
		return i;
	}

	public int read(byte[] b, int off, int len) throws IOException 
	{
		int i = is2.read(b, off, len);
		if (i == -1) 
		{ 
			onedone = true;
			i = is.read(b, off, len); 
		}
		
		return i;
	}

	public int available() throws IOException 
	{
		if (onedone) return is.available();
		return is2.available();
	}

	public void close() throws IOException 
	{
		super.close();
		is.close();
		is2.close();
	}
}
