package com.newbound.net.service.http;

import java.io.IOException;
import java.io.InputStream;

import com.newbound.net.service.Response;

public class HTTPResponse extends InputStream implements Response
{
	public boolean KEEPALIVE = false;
	
	boolean onedone = false;
	InputStream is = null;
	InputStream is2 = null;
	public int LEN = -1;
	
	public HTTPResponse(InputStream a, InputStream b, int len)
	{
		super();
		is = a;
		is2 = b;
		LEN = len;
	}
	
	public HTTPResponse(InputStream a, InputStream b, int len, int rangebegin, int rangeend) throws IOException
	{
		super();
		is = a;
		is2 = b;
		LEN = rangeend == -1 ? len : Math.min(len, rangeend-rangebegin+1);
		if (rangebegin >0) 
		{
			int n = 0;
			while (n<rangebegin) n += is.skip(rangebegin-n);
		}
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
		
//		synchronized (is) { is.notifyAll(); }
	}
}