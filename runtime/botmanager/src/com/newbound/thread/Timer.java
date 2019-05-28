package com.newbound.thread;

import java.util.Enumeration;
import java.util.Hashtable;

import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.robot.Callback;

public class Timer 
{
	Hashtable<String, TimerTask> mTasks = new Hashtable();
	Callback mCallback = null;
	boolean mRunning = false;

	public void stop() 
	{
		synchronized (this)
		{
			mRunning = false;
			Enumeration<String> e = mTasks.keys();
			while (e.hasMoreElements()) try
			{
				String id = e.nextElement();
				TimerTask task = mTasks.get(id);
				task.stop();
			}
			catch (Exception x) { x.printStackTrace(); }
		}
	}

	public void init(JSONArray tasks, Callback cb) 
	{
		mCallback = cb;
		int i = tasks.length();
		while (i-->0) try
		{
			JSONObject task = tasks.getJSONObject(i);
			TimerTask tt = new TimerTask(task, cb);
			mTasks.put(tt.getID(), tt);
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	public void start() 
	{
		synchronized (this)
		{
			mRunning = true;
			Enumeration<String> e = mTasks.keys();
			while (e.hasMoreElements()) try
			{
				String id = e.nextElement();
				TimerTask task = mTasks.get(id);
				task.start();
			}
			catch (Exception x) { x.printStackTrace(); }
		}
	}

	public void kill(String id) 
	{
		TimerTask tt = mTasks.remove(id);
		if (tt != null) tt.stop();
	}

	public void set(String id, JSONObject task) throws Exception
	{
		synchronized (this)
		{
			kill(id);
			task.put("id", id);
			TimerTask tt = new TimerTask(task, mCallback);
			if (mRunning) tt.start();
			mTasks.put(id, tt);
		}
	}

}
