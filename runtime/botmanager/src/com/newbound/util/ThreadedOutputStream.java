package com.newbound.util;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Vector;

import com.newbound.net.service.App;

public class ThreadedOutputStream extends OutputStream 
{
	private static int BUFLEN = 4096;
	
	private Object MUTEX = new Object();
	OutputStream OS;
	App APP;
	
	long maxbytespermillis;
	byte[] bytes = new byte[BUFLEN];
	int offset = 0;
	Vector<byte[]> mQueue = new Vector();
	
	boolean closing = false;

	public ThreadedOutputStream(App app, OutputStream os, int bytespermillis) 
	{
		OS = os;
		APP = app;
		maxbytespermillis = bytespermillis;
		
		final String name = "Threaded Output Stream "+app.getID()+"/"+OS.getClass();
		
		app.addJob(new Runnable() 
		{
			@Override
			public void run() 
			{
				long last = System.currentTimeMillis();
//				RollingAverage ra = new RollingAverage(10);
				
				while (OS != null)
				{
//					System.out.println("loop begin");
					synchronized (MUTEX)
					{
//						System.out.println("inside loop");
						if (mQueue.size() == 0) 
						{
							if (closing)
							{
								try { OS.flush();} catch (Exception x) { x.printStackTrace(); }
								try { OS.close();} catch (Exception x) { x.printStackTrace(); }
								OS = null;
								break;
							}
							else try
							{
								OS.flush();
//								System.out.println("waiting");
								MUTEX.wait();
//								System.out.println("notified");
							}
							catch (Exception x) { x.printStackTrace(); }
						}
							
						int total = 0;
						long now = System.currentTimeMillis();
						long dt = now - last;
						if (dt == 0) dt = 1;
						
						last = now;
						while (mQueue.size() > 0) try
						{
							byte[] ba = mQueue.remove(0);
							OS.write(ba);
							total += ba.length;
//							System.out.println(name+" wrote "+ba.length+" bytes");
							
//							ra.add(total/dt);
//							int bytespermillis = (int)ra.value();
//							System.out.println(bytespermillis);
							long dur = (total / maxbytespermillis) - dt;
							if (dur>0)
							{
								// NOTE: Throttles BOTH sendBytes and Runnable with lock on both MUTEX and this
//								System.out.println((total / dt) + " b/ms - throttling "+dur);
								synchronized(this) { try { wait(dur); } catch (Exception x) { x.printStackTrace(); } }
							}
						}
						catch (Exception x)
						{
							x.printStackTrace();
							if (OS != null) try { OS.close(); } catch (Exception xx) { xx.printStackTrace(); }
							OS = null;
						}
					}
				}
				System.out.println("FINISHED Threaded Output Stream "+name);
			}
		}, name);
	}

	public void write(int b) throws IOException 
	{
		bytes[offset++] = (byte)b;
		if (offset == BUFLEN) sendBytes();
	}

	public void write(byte[] b, int off, int len) throws IOException 
	{
		int n = 0;
		while (n<len)
		{
			int x = bytes.length - offset;
			if (x>len-n) x = len-n;
			System.arraycopy(b, off, bytes, offset, x);
			offset += x;
			off += x;
			n += x;
		
			if (offset == BUFLEN) sendBytes();
		}
	}

	private void sendBytes() throws IOException
	{
		if (offset == 0) return;
				
//		System.out.println("sending bytes");
		try
		{
			byte[] data = new byte[offset];
			System.arraycopy(bytes, 0, data, 0, offset);
			mQueue.addElement(data);
			offset = 0;
//			System.out.println("notifying");
			synchronized (MUTEX) { MUTEX.notify(); }
//			System.out.println("bytes sent");
		}
		catch (Exception x2) 
		{ 
			x2.printStackTrace();
			throw new IOException(x2.getMessage()); 
		}
	}

	public void close() throws IOException 
	{
		sendBytes();
		closing = true;
		synchronized (MUTEX) { MUTEX.notifyAll(); }
	}

	public void flush() throws IOException 
	{
//		System.out.println("flush");
		sendBytes();
	}
}
