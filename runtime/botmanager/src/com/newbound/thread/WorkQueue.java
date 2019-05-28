package com.newbound.thread;

import com.newbound.util.NoSuchNodeException;
import com.newbound.util.Queue;

/**
 * This class holds units of work in a queue for threads to extract from.
 */
/**
 *	FILE:
 *		WorkQueue.java
 *	
 *	COPYRIGHT:
 *		� 1997, EveryDay Objects, Inc., all rights reserved.  This source code or
 *		the object code resulting from compilation of said source may not be sold
 *		or distributed in any form without permission of EveryDay Objects, Inc.
 *	
 *	DESCRIPTION:
 *		Class which implements a work queue.
 *		This class holds units of work in a queue for threads to extract from.
 *	
 *	CHANGE HISTORY:
 *		97.10.28   dea   Created file.
 */

public class WorkQueue extends Queue {
public Object lock = new Object();
public boolean mRunning = true;


/**
 * Basic Constructor
 */
public WorkQueue()
{
}

/**
 * This method adds a job to the queue.  It then calls notify() to alert any
 * waitings thread that there is work.  The thread scheduler will choose one
 * of the waiting threads.
 * @param j The Runnable object to add.
 */
public void addJob(Runnable j)
{
	addJob(j, "UNTITLED THREAD");
}

/**
 * This method adds a named job to the queue.  It then calls notify() to alert any
 * waitings thread that there is work.  The thread scheduler will choose one
 * of the waiting threads and the Job class will set the Thread's name.
 * @param j The Runnable object to add.
 */
public void addJob(Runnable j, String threadName)
{
	addJobInternal(new Job(j, threadName));
}

protected void addJobInternal(Job j)
{
	int i = size();
	if (i>0) System.out.println("ADDING WORK QUEUE SIZE: "+i);
	push(j); 
	synchronized (lock) { lock.notify();	 } // Tell those who are waiting there's work to do.
}

/**
 * This method returns a Runnable job from the queue.
 * @return Runnable
 */
public Runnable getSomeWork()
{
	int i = size();
	if (i>0) System.out.println("GETTING WORK QUEUE SIZE: "+i);
	try
	{	
		Thread.currentThread().setName("No work");
		if (isEmpty()) 
		{
		    if (mRunning) lock.wait(5000);
		    else 
		    {
		    	Thread.currentThread().setName("No work");
		    	return null;
		    }
		}
		return (Runnable)pop();
	}
	catch (NoSuchNodeException e)  { return null; }
	catch (InterruptedException e) { return null; }
}

public void flush()
{
    if (!isEmpty()) synchronized (lock) { lock.notifyAll(); }
}
}
