package com.newbound.thread;

import org.json.JSONObject;

import com.newbound.code.Code;
import com.newbound.robot.BotBase;
import com.newbound.robot.BotManager;
import com.newbound.robot.Callback;

public class TimerTask 
{
	String id;
	String cmd;
	String cmddb;
	JSONObject params;
	long next;
	boolean repeat;
	long millis;

	Code mCode;
	PeriodicTask mPeriodicTask;
	Callback mCallback;
	
	public TimerTask(final JSONObject task, Callback cb) throws Exception
	{
		id = task.getString("id");
		cmd = task.getString("cmd");
		cmddb = task.getString("cmddb");
		params = task.getJSONObject("params");
		long start = task.getInt("start");
		String unit = task.getString("startunit");
		long now = System.currentTimeMillis();
		if (start == 0) next = now;
		else if (start > 10000) next = start;
		else start = now + calcMillis(start, unit);
		repeat = task.getBoolean("repeat");
		long repeatinterval = repeat ? task.getLong("interval") : 0;
		String repeatunit = repeat ? task.getString("intervalunit") : "milliseconds";
		millis = calcMillis(repeatinterval, repeatunit);
		
		mCallback = cb;
		
		final JSONObject jo = BotBase.getBot("botmanager").getData(cmddb, cmd).getJSONObject("data");
		mCode = new Code(jo, cmddb);

		mPeriodicTask = new PeriodicTask(next-now, repeat, "Timer Task - "+cmddb+"/"+cmd) 
		{
			
			@Override
			public void run() 
			{
				try {
					BotManager bm = ((BotManager) BotBase.getBot("botmanager"));
					params.put("sessionid", bm.systemSessionID());
					System.out.println("EXECUTING TIMER TASK: " + cmddb + ":" + cmd + " - " + params);
					try {
						task.put("result", mCode.execute(params));
						if (mCallback != null) mCallback.execute(task);
					} catch (Exception x) {
						x.printStackTrace();
					}
					System.out.println("DONE EXECUTING TIMER TASK: " + task);

					mMillis = millis;
				}
				catch (Exception x) { x.printStackTrace(); }
			}
		};
	}

	private long calcMillis(long start, String unit) throws Exception 
	{
		if (!unit.equals("milliseconds"))
		{
			start *= 1000l;
			if (!unit.equals("seconds"))
			{
				start *= 60l;
				if (!unit.equals("minutes"))
				{
					start *= 60l;
					if (!unit.equals("hours"))
					{
						start *= 24l;
						if (!unit.equals("days")) throw new Exception("Unknown task start unit: "+unit);
					}
				}
			}
		}
		return start;
	}

	public String getID() 
	{
		return id;
	}

	public void start() 
	{
		BotBase.getBot("botmanager").addPeriodicTask(mPeriodicTask);
	}

	public void stop() 
	{
		mPeriodicTask.die();
	}

}
