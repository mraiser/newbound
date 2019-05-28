package com.newbound.net.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.SocketAddress;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.util.Hashtable;

import com.newbound.robot.Callback;
import com.newbound.thread.ThreadHandler;
import com.newbound.util.IsRunning;

public class Service
{
	public Container CONTAINER = null;

	protected boolean RUNNING = false;
	protected String NAME = null;

	public IsRunning ISRUNNING = new IsRunning() 
	{
		@Override
		public boolean isRunning() 
		{
			return RUNNING;
		}
	};
	
	protected Hashtable<Object, Callback> callbacks = new Hashtable();
	protected ServerSocket SS;
	
	public Service(final ServerSocket ss, final String name, final Class parser, Container th) throws IOException 
	{
		final Service me = this;
		
		SS = ss;
		CONTAINER = th;
		NAME = name;
		
		th.find("botmanager").addJob(new Runnable() 
		{
			public void run() 
			{
				RUNNING = true;
				System.out.println("Service "+name+" starting up...");
				while (RUNNING) try 
				{ 
					final Socket s = ss.accept();
					Parser p = (Parser)(parser.newInstance());
					if (p.init(me, s)) listen(s, p);
				} 
				catch (Exception x) { x.printStackTrace(); }
				
				System.out.println("Service "+name+" stopped.");
			}
		}, "SERVICE "+name+" listening on "+SS.getLocalSocketAddress());
	}

	public void listen(final Socket s, final Parser p) throws Exception
	{
		CONTAINER.getDefault().addJob(new Runnable() 
		{
			public void run() 
			{
				while (RUNNING && s.isConnecting() && ! s.isClosed()) try { Thread.sleep(500); } catch (Exception x) { x.printStackTrace(); }
				
				boolean release = false;
				
				while (RUNNING && s.isConnected() && !s.isClosed()) try 
				{
					Request jo2 = (Request)p.parse();
					Object cmd = jo2.getCommand();
					execute(cmd, jo2, p);
				} 
				catch (ReleaseSocketException x)
				{
					release = true;
					break;
				}
				catch (SocketTimeoutException x)
				{
					System.err.println(NAME+" REQUEST TIMEOUT: "+x.getMessage());
					break;
				}
				catch (SocketException x)
				{
					System.err.println(NAME+" REQUEST SOCKET ERROR: "+x.getMessage());
					break;
				}
				catch (SocketClosedException x)
				{
					System.out.println(NAME+" socket closed ");
					break;
				}
				catch (Exception x) 
				{ 
					p.error(x);
				}

				if (!release)
				{
					try { p.close(); } catch (Exception xx) { xx.printStackTrace(); }
					try { s.close(); } catch (Exception xx) { xx.printStackTrace(); } 
				}
				
				System.out.println("SOCKET "+NAME+" "+s+" listen loop END");
			}
		}, "SOCKET "+NAME+" "+s+" listen loop BEGIN");
	}

	public void on(Object cmd, Callback callback) 
	{
		callbacks.put(cmd, callback);
	}
	
	protected void execute(final Object cmd, final Request data, final Parser parser) throws Exception
	{
/*		
		CONTAINER.getDefault().addJob(new Runnable() 
		{
			@Override
			public void run() 
			{
				try
				{
*/
					Callback cb = callbacks.get(cmd);
					if (cb == null) throw new Exception("No such command: "+cmd);
					parser.execute(data, cb);
/*
				}
				catch (Exception x)
				{
					parser.error(x);
				}
			}
		}, "Executing P2P command");
*/
	}

	public void close() throws IOException
	{
		RUNNING = false;
		SS.close();
	}

	public SocketAddress getLocalSocketAddress() 
	{
		return SS.getLocalSocketAddress();
	}
}