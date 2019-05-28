package com.newbound.thread;


/**
 *	FILE:
 *		CommandThread.java
 *	
 *	COPYRIGHT:
 *		� 1997, EveryDay Objects, Inc., all rights reserved.  This source code or
 *		the object code resulting from compilation of said source may not be sold
 *		or distributed in any form without permission of EveryDay Objects, Inc.
 *	
 *	DESCRIPTION:
 *		Class which implements a thread for executing commands.
 *	
 *	CHANGE HISTORY:
 *		97.10.28   dea   Created file.
 */

public class CommandThread extends Thread {
	private boolean onDuty = false;
	private ThreadHandler mThreadHandler = null;
	private boolean working = false;
	
	public String pid = "xxx";
		
/**
 * Basic Constructor
 */
public CommandThread(ThreadHandler th)
{
	mThreadHandler = th;
	setName("No task");
}
/**
 * Returns the value of the onDuty field.
 * @return boolean
 */
public boolean isOnDuty()
{
	return onDuty;
}
/**
 * Sets the value of the onDuty field to true.
 */
public void putOnDuty()
{
	onDuty = true;
}
public boolean isWorking()
{
	return working;
}
/**
 * Execute this Command Thread
 */
public void run()
{
	Runnable job = null;
	onDuty = true;
	
    try
    {
        while (onDuty) 
		{
			try
			{
				setName("No work");
					WorkQueue queue = mThreadHandler.getWorkQueue();
					
					synchronized (queue.lock)
					{
						// Now, get a job from the WorkQueue, this will block until a
						// notify() is received.
						job = (Runnable)queue.getSomeWork();
					}

					if (job != null) //try
					{
							setName(job.toString());
							working = true;
					    	job.run();
					    	working = false;
					    	setName("No work");
					}
			}
			catch (Throwable x)
			{
				// FIXME
				// Log this
//				if (TNS_Sys.DEBUG) 
					x.printStackTrace();
			}
		}
	}
    finally
    {
    	mThreadHandler.bye(this);
    }
}
/**
 * Sets the value of the onDuty field to false.
 */
public void takeOffDuty()
{
	onDuty = false;
}

public String toString()
{
	return super.toString() +" PID: "+pid+ (onDuty ? " [ACTIVE]" : "");
}

}
