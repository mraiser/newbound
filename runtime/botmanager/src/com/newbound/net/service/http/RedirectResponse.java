package com.newbound.net.service.http;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Hashtable;

public class RedirectResponse extends HTTPResponse 
{
	static String response = "HTTP/1.1 302 Found\r\nLocation: ";
	
	public RedirectResponse(String url) throws IOException
	{
		super("302 Found", buildHeader(url), buildBody());
	}

	private static InputStream buildBody() 
	{
		String s = "";
		return new ByteArrayInputStream(s.getBytes());
	}

	private static Hashtable buildHeader(String url)
	{
		Hashtable h = new Hashtable();
		h.put("Location",url);
		h.put("Content-Length",0);
		return h;
	}

}
