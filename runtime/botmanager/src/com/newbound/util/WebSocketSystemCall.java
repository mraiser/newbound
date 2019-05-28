package com.newbound.util;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

import org.json.JSONObject;

import com.newbound.robot.BotBase;

public class WebSocketSystemCall 
{
	public static void call(final BotBase b, String[] cmd, final String guid, final InputStream stdin)
	{
		try
		{
			final Process bogoproc = Runtime.getRuntime().exec(cmd);
			
			b.addJob(new Runnable() 
			{
				@Override
				public void run() 
				{
					try
					{
						byte[] buf = new byte[4096];

						InputStream es = bogoproc.getErrorStream();
						JSONObject jo = new JSONObject();
						jo.put("guid", guid);
					
						while (true)
						{
							int i = es.read(buf);
							if (i == -1) break;
							
							jo.put("text", new String(buf, 0, i));
							jo.put("type", "stderr");
							
							b.sendWebsocketMessage(jo.toString());
						}
						es.close();
					} 
					catch (Exception x) { x.printStackTrace(); }
				}
			});
			
			b.addJob(new Runnable() 
			{
				@Override
				public void run() 
				{
					try
					{
						byte[] buf = new byte[4096];

						InputStream is = new BufferedInputStream(bogoproc.getInputStream());
						JSONObject jo = new JSONObject();
						jo.put("guid", guid);

						while (true)
						{
							int i = is.read(buf);
							if (i == -1) break;
							
							jo.put("text", new String(buf, 0, i));
							jo.put("type", "stdin");
							
							b.sendWebsocketMessage(jo.toString());
						}
						is.close();
					} 
					catch (Exception x) { x.printStackTrace(); }
				}
			});
	
			if (stdin != null) b.addJob(new Runnable() 
			{
				@Override
				public void run() 
				{
					try
					{
						OutputStream os = new BufferedOutputStream(bogoproc.getOutputStream());
						b.sendData(stdin, os, -1, 4096);
						os.flush();
						os.close();
						
						stdin.close();
					} catch (Exception x) { x.printStackTrace(); }
				}
			});
		}
		catch (Exception x) 
		{
			try
			{
				JSONObject jo = new JSONObject();
				jo.put("guid", guid);
				jo.put("text", x.getMessage());
				jo.put("type", "stderr");
				b.sendWebsocketMessage(jo.toString());
			}
			catch (Exception xx) { xx.printStackTrace(); }
		}
	}
}
