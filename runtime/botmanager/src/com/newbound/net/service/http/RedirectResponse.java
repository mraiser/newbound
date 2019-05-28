package com.newbound.net.service.http;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

public class RedirectResponse extends HTTPResponse 
{
	static String response = "HTTP/1.1 302 Found\r\nLocation: ";
	
	public RedirectResponse(String url) 
	{
		super(buildBody(), buildHeader(url), 0);
	}

	private static InputStream buildBody() 
	{
		String s = "";
		return new ByteArrayInputStream(s.getBytes());
	}

	private static InputStream buildHeader(String url) 
	{
		String s = response+url+"\r\nContent-Length: 0\r\n\r\n";
		return new ByteArrayInputStream(s.getBytes());
	}

}
