package com.newbound.util;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Vector;

import com.newbound.net.service.App;

public class ThrottledOutputStream extends OutputStream 
{
	OutputStream OS;
	
	long maxbytespermillis;

	public ThrottledOutputStream(OutputStream os, int bytespermillis) 
	{
		OS = os;
		maxbytespermillis = bytespermillis;
	}

	public void write(int b) throws IOException 
	{
		OS.write(b);
		checkBPM(1);
	}

	public void write(byte[] b, int off, int len) throws IOException 
	{
		OS.write(b, off, len);
		checkBPM(len);
	}

	long last = System.currentTimeMillis();
	private void checkBPM(int len) 
	{
		long now = System.currentTimeMillis();
		long dt = now - last;
		if (dt == 0) dt = 1;

		long dur = (len / maxbytespermillis) - dt;
		if (dur>0)
		{
			synchronized(this) { try { wait(dur); } catch (Exception x) { x.printStackTrace(); } }
		}
	}

	public void close() throws IOException 
	{
		OS.close();
	}

	public void flush() throws IOException 
	{
		OS.flush();
	}
}
