package com.newbound.thread;

public abstract class PeriodicTask implements Runnable
{
	protected long mTimeToRun = 0;
	protected long mMillis = 0;
	protected boolean mRepeat = false;
	protected String mName = "UNTITLED THREAD";
	protected boolean mDead = false;
	
	public PeriodicTask(long millis, boolean repeat, String name)
	{
		mMillis = millis;
		mRepeat = repeat;
		mName = name;
	}

	public long getTimeToRun()
	{
		return mTimeToRun;
	}

	public void setTimeToRun(long timeToRun)
	{
		mTimeToRun = timeToRun;
	}

	public long getMillis()
	{
		return mMillis;
	}

	public void setMillis(long millis)
	{
		mMillis = millis;
	}

	public boolean isRepeat()
	{
		return mRepeat;
	}

	public void setRepeat(boolean repeat)
	{
		mRepeat = repeat;
	}

	public String getName()
	{
		return mName;
	}

	public void setName(String name)
	{
		mName = name;
	}

	public void die() { mDead = true; }

	public boolean isDead() 
	{
		return mDead;
	}
}
