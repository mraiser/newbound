package com.newbound.net.service;

import java.io.InputStream;
import java.io.OutputStream;

public class PipeStreamer 
{
	public PipeStreamer(final App app, final InputStream is, final OutputStream os, final String threadname)
	{
		app.addJob(new Runnable() 
		{
			@Override
			public void run() 
			{
				try
				{
					System.out.println(threadname+" BEGIN");

					byte[] ba = new byte[4096];
					int i;
					while (app.running())
					{
						i = is.read(ba);
						if (i == -1) break;
						System.out.println(threadname+" "+i+" bytes");
						os.write(ba, 0, i);
					}
				}
				catch (Exception x) { x.printStackTrace(); }
				
				System.out.println(threadname+" END");

				try { is.close(); } catch (Exception x) { x.printStackTrace(); }
				try { os.close(); } catch (Exception x) { x.printStackTrace(); }
			}
		}, threadname);
	}
}
