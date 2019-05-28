package com.newbound.thread;

/**
 *	FILE:
 *		Job.java
 *	
 */

public class Job implements Runnable 
{
	protected Runnable mRunnable;
	protected String mThreadName;
	
	public Job(Runnable r, String threadName)
	{
		mRunnable = r;
		mThreadName = threadName;
	}

	public void run()
	{
		Thread.currentThread().setName(mThreadName);
		mRunnable.run();
		Thread.currentThread().setName("WAITING");
	}
	
	public String toString()
	{
		return mThreadName;
	}
}