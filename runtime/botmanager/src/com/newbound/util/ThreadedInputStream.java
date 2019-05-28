package com.newbound.util;

import java.io.IOException;
import java.io.InputStream;
import java.util.Vector;

import com.newbound.net.service.App;

public class ThreadedInputStream extends InputStream 
{
	InputStream IS;
	Vector<byte[]> mQueue = new Vector();
	
	Object MUTEX = new Object();
	byte[] BUF = new byte[4096];
	
	byte[] bytes = null;
	int offset = 0;
	int len = 0;
	
	int size = 0;
	
	public ThreadedInputStream(App app, InputStream is)
	{
		IS = is;
		
		app.addJob(new Runnable() 
		{
			
			@Override
			public void run() 
			{
				try
				{
					long last = System.currentTimeMillis();
					int lastsize = size;
					int delta;
					
					int i;
					long now;
					long millis;
					
					double bpm_out;
					double bpm_in;
					
					while (IS != null && (i = IS.read(BUF)) != -1)
					{
						delta = size - lastsize;
						
						now = System.currentTimeMillis();
						millis = now - last;
						if (millis < 1) millis = 1;
						last = now;
						
						bpm_out = delta/millis;
						
						byte[] ba = new byte[i];
						System.arraycopy(BUF, 0, ba, 0, i);
						mQueue.addElement(ba);
						size += i;
						
						bpm_in = i/millis;
						
						lastsize = size;
						
						System.out.println("SIZE: "+size+" IN: "+((int)bpm_in)+" b/ms / OUT: "+((int)bpm_out)+" b/ms");

						synchronized (MUTEX) { MUTEX.notify(); }
					}
				}
				catch (Exception x) { x.printStackTrace(); }
				
				IS = null;
			}
		}, "Threaded Input Stream "+app.getID()+"/"+IS.getClass());
	}

	public int read() throws IOException 
	{
		if (ensureBytes() == -1) return -1;
		size--;
		return 0xFF & bytes[offset++];
	}

	private int ensureBytes() 
	{
		synchronized (MUTEX) 
		{ 
			if (offset == len) bytes = null;
			if (bytes == null && mQueue.size() == 0) 
			{
				if (IS == null)
				{
					System.out.println("ThreadedInputStream READ NO MORE BYTES");
					return -1;
				}
				else
				{
					try { MUTEX.wait(); } catch (Exception x) { x.printStackTrace(); } 
				}
			}
		}
		
		if (bytes == null)
		{
			if (mQueue.size() == 0) return -1;
			
			bytes = mQueue.remove(0);
			len = bytes.length;
			offset = 0;
			if (len == 0) 
			{
				bytes = null;
				return ensureBytes();
			}
		}
		
		return bytes.length;
	}

	public int read(byte[] b, int off, int len) throws IOException 
	{
		if (len == 0) return 0;
		
		if (ensureBytes() == -1) return -1;
		
		int n = bytes.length - offset;
		if (len < n) n = len;
		System.arraycopy(bytes, offset, b, off, n);
		offset += n;
		size -= n;
		
		int x = len - n;
		if (mQueue.size() > 0)
		{
			n += read(b, off+n, x);
		}
		
		return n;
	}

	public int available() throws IOException 
	{
//		int i = 0;
//		if (bytes != null) i += bytes.length - offset;
//		int n = mQueue.size();
//		while (n-->0) i += mQueue.elementAt(n).length;
		
		return size;
	}

	public void close() throws IOException 
	{
		if (IS != null)
		{
			IS.close();
			IS = null;
		}
		
		synchronized (MUTEX) { MUTEX.notifyAll(); }
		
		super.close();
	}

}
