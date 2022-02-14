package com.newbound.net.service.http;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.Hashtable;

import com.newbound.robot.BotUtil;

public class ExceptionResponse extends HTTPResponse 
{
	public ExceptionResponse(int i, String s, File f) throws IOException
	{
		super(i+" "+s, buildHeader(i, s, f), buildBody(i, s, f));
	}

	private static String buildBodyString(int i, String s, File f)
	{
		String body = null;
		if (f != null && f.exists()) try { body = new String(BotUtil.readFile(f)); } catch (Exception x) {};
		if (body == null)
		{
			body = "<html><head><title>"+i+" "+s+"</title></head><body><h1>"
					+ i
					+ "</h1>"
					+ s
					+ "</body></html>";
		}
//		System.out.println(body);
//		System.out.println(body.length());
		return body;
	}

	private static InputStream buildBody(int i, String s, File f) 
	{
		String body = buildBodyString(i, s, f);
		return new ByteArrayInputStream(body.getBytes());
	}

	private static Hashtable buildHeader(int i, String s, File f)
	{
		int len = f != null && f.exists() ? (int)f.length() : 64 + ((s+i).length() * 2);
		Hashtable h = new Hashtable();
		h.put("Content-Length",len);
		h.put("Content-Type","text/html");
		return h;
	}

	public static void main(String[] args)
	{
		String s = buildBodyString(404, "", null);
		System.out.println(s);
		System.out.println(s.length());
	}
}
