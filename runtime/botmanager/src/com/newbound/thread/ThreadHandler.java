package com.newbound.thread;


import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.PrintStream;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Map;
import java.util.Vector;

import com.newbound.robot.BotManager;
import com.newbound.robot.SYS;
import com.newbound.util.*;

/**
 *	FILE:
 *		ThreadHandlerImpl.java
 *	
 *	COPYRIGHT:
 *		� 1997, EveryDay Objects, Inc., all rights reserved.  This source code or
 *		the object code resulting from compilation of said source may not be sold
 *		or distributed in any form without permission of EveryDay Objects, Inc.
 *	
 *	DESCRIPTION:
 *		Class which implements an object that holds a unit of work - a Job.
 *	
 *	CHANGE HISTORY:
 *		97.10.30   dea   Created file.
 */

public class ThreadHandler
{
	private static final Vector<ThreadHandler> mThreadHandlers = new Vector(); 
	private static final Vector<PeriodicTask> mPeriodicTasks = new Vector(); 
	private static Thread mPTT = null;
	
	private WorkQueue mQueue = new WorkQueue();
	private Vector<CommandThread> mThreads = new Vector();
	private int mMaxThreads  = 0;
	private String mName = "T";
	
	private ThreadTracker mTracker = new ThreadTracker();

	/**
	 * Basic Constructor
	 */
	public ThreadHandler(String s)
	{
		mName = s;
		mThreadHandlers.addElement(this);
	
		System.out.println("New ThreadHandler "+s);
		
//		for (String ss : mTracker.threads) {
//			System.out.println("linux thread id = " + mTracker.parentId + " " + ss);
//		}
	}
	
	public int size()
	{
		return mThreads.size();
	}
	
	/**
	 * Add a Runnable object to the work queue.
	 * @param o java.lang.Runnable
	 */
	public int available() 
	{
	//	//synchronized(threads)
	//	{
			int n = mThreads.size();
			int i = n;
			while (i-->0) if (mThreads.elementAt(i).isWorking()) n--;
			return n;
	//	}
	}
	
	public int waiting()
	{
		return mQueue.size();
	}
	
	public void addJob (Runnable o ) 
	{
		lazyLoad();
		getWorkQueue().addJob(o);
	}
	
	/**
	 * Add a Runnable object to the work queue.
	 * @param o java.lang.Runnable
	 * @param s java.lang.String
	 */
	public void addJob (Runnable o, String s) 
	{
		lazyLoad();
		getWorkQueue().addJob(o,mName+" "+s);
	}
	
	/**
	 * Create additional threads.
	 * @param int The number of threads that will be allocated when done.
	 */
	public void addNumThreads(int numToAllocate)
	{
		mMaxThreads += numToAllocate;
	}
	
	private void addThread() 
	{
		//synchronized(threads)
		{
			CommandThread t = new CommandThread(this);
			mThreads.addElement(t);
			t.start();
			
			t.pid = mTracker.guessNewLinuxThreadId();
		}
	}
	
	/**
	 * Returns the WorkQueue instance.
	 * @return WorkQueue
	 */
	public WorkQueue getWorkQueue()
	{
		return mQueue;
	}
	
	/**
	 * Initialize this handler.
	 * @exception tns.sys.handler.HNDLR_InitFailed Unable to initialize.
	 */
	public void init(File rootDirx) throws Exception
	{		
		// Allocate and start the threads.
	//	addThread(); // Everybody gets one
	//	addThread(); // Actually, everybody gets two
		
		synchronized(mPeriodicTasks)
		{
			if (mPTT == null)
			{
				// Start Periodic Task Thread
				Runnable r = new Runnable()
				{
					public void run()
					{
						while (!SYS.RUNNING) try { Thread.sleep(100); } catch (Exception x) {}

						while (getWorkQueue().mRunning)
						{
							int num = 0;
							
							try
							{
								synchronized(mPeriodicTasks)
								{
									int i = mPeriodicTasks.size();
									if (i == 0) mPeriodicTasks.wait(1000);
									else
									{
//										System.out.println("PERIODIC TASK SWEEP");
										
										long now = System.currentTimeMillis(); 
										while (i-->0)
										{
											final PeriodicTask pt = (PeriodicTask) mPeriodicTasks.elementAt(i);
											if (pt.isDead()) mPeriodicTasks.removeElementAt(i);
											else if (!(pt.getTimeToRun() > now))
											{
//												System.out.println(i+": "+pt);
												mPeriodicTasks.removeElementAt(i);

												Runnable r2 = new Runnable()
												{
													public void run()
													{
														pt.run();
														if (pt.mRepeat) addPeriodicTask(pt);
													}
												};
												
												addJob(r2, pt.getName());
												num++;
											}
										}
										
										if (num == 0) Thread.sleep(100);
									}
								}
							}
							catch (Exception x)
							{
								x.printStackTrace();
							}
							
							Thread.yield();
						}
					}
				};
				
				mPTT = new Thread(r, "PERIODIC TASKS");
				mPTT.start();
			}
		}
	//	new Thread(r, "Periodic Task Loop").start();
	}
	
	/**
	 * The method sets the onDuty flag of all CommandThreads to true.
	 */
	public void putAllThreadsOnDuty()
	{
		//synchronized(threads)
		{
			CommandThread ct;
			Enumeration   e = mThreads.elements();
			
			while (e.hasMoreElements())
			{
				ct = (CommandThread)e.nextElement();
				ct.putOnDuty();
			}
		}
	}
	
	/**
	 * Resets the total number of threads in the vector.
	 * @param int The number of threads that will be allocated when done.
	 */
	public void resetNumThreads(int n)
	{
		//synchronized(threads)
		{
			mMaxThreads = n;
			
		    int numThreads = mThreads.size();
		
			if (numThreads>n)
			{
			    Runnable r = new Runnable()
			    {
			        public void run()
			        {
			            CommandThread t = (CommandThread)Thread.currentThread();
			            t.takeOffDuty();
			        }
			    };
		
				int numToDestroy = numThreads - n;
			
			    for (int i = 0; i < numToDestroy; i++)
				{
				    addJob(r);
				}
			    
			    getWorkQueue().flush();
			}
		}
	}
	
	/**
	 * Shut down this handler.
	 * @exception tns.sys.handler.HNDLR_ShutDownFailed Unable to shut down.
	 */
	public void shutdown() throws Exception
	{
	    getWorkQueue().mRunning = false;
	    takeAllThreadsOffDuty();
/*	    
	    long end = System.currentTimeMillis() + 30000;
		while (System.currentTimeMillis() < end) try
		{
		    if (mThreads.size() == 0) break;
		    
		    getWorkQueue().flush();
		    Thread.sleep(1000);
		}
		catch (Exception x) { x.printStackTrace(); }
		
		Enumeration e = mThreads.elements();
		while (e.hasMoreElements())
		{
		    try
		    {
			    CommandThread ct = (CommandThread)e.nextElement();
			    ct.takeOffDuty();
			    
	//		    FIXME: STOP IT
	//		    ct.stop();
			}
		    catch (Exception x) { x.printStackTrace(); }
		}
*/
	}
	
	/**
	 * The method sets the onDuty flag of all CommandThreads to false.
	 */
	public void takeAllThreadsOffDuty()
	{
		resetNumThreads(0);
	}
	
	/* (non-Javadoc)
	 * @see tns.sys.handler.ThreadHandler#setNumThreads(int)
	 */
	//public void setNumThreadsX(int n)
	//{
		// Whaaaaaa?
	//    initialThreads = 5;
	//}
	/* (non-Javadoc)
	 * @see tns.sys.handler.ThreadHandler#bye(tns.sys.thread.CommandThread)
	 */
	public void bye(CommandThread thread)
	{
		//synchronized(threads)
		{
			mThreads.removeElement(thread);
		}
	}
	
	/* (non-Javadoc)
	 * @see tns.sys.handler.ThreadHandler#addJobs(java.util.Vector, int, java.lang.String)
	 */
	public JobGroup addJobs(Vector v, int maxThreads, String label, long timetowait)
	{
	    JobGroup jg = new JobGroup(mName+" "+label, this, maxThreads);
	    int i = v.size();
	    while (i-->0) jg.addJob((Runnable)v.elementAt(i)); 
	
	    return jg;
	}
	
	public void removeNumThreads(int numToRemove)
	{
		//synchronized(threads)
		{
			resetNumThreads(mMaxThreads - numToRemove);
		}
	}
	
	public void addPeriodicTask(PeriodicTask pt)
	{
		synchronized(mPeriodicTasks)
		{
			if (mPeriodicTasks.indexOf(pt) != -1)
				System.out.println("WARNING! Attempt to add the same periodic task twice! "+pt);
			else
			{
				lazyLoad();
				pt.mTimeToRun = System.currentTimeMillis() + pt.mMillis;
				mPeriodicTasks.addElement(pt);
				mPeriodicTasks.notify();
			}
		}
	}
	
	public void addPeriodicTask(final Runnable r, long millis, String s, final IsRunning ir)
	{
		synchronized(mPeriodicTasks)
		{
			lazyLoad();
			PeriodicTask pt = new PeriodicTask(millis, true, mName+" "+s)
			{
				public void run()
				{
					if (ir.isRunning()) r.run();
					else setRepeat(false);
				}
			};
			
			pt.mTimeToRun = System.currentTimeMillis() + pt.mMillis;
			mPeriodicTasks.addElement(pt);
			mPeriodicTasks.notify();
		}
	}
	
	private void lazyLoad()
	{
	//	//synchronized(threads)
		try
		{
			if (available()< 1 && mThreads.size() < mMaxThreads) addThread();
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	public static String report()
	{
		ByteArrayOutputStream baos = new ByteArrayOutputStream();
		PrintStream ps = new PrintStream(baos);
		ps.println("---------------- THREADS ----------------");
		Thread[] tarray = new Thread[Thread.activeCount()];
		Thread.enumerate(tarray);
		Map<Thread, StackTraceElement[]> map = Thread.getAllStackTraces();

		int count = tarray.length;
		Hashtable<String, Integer> counts = new Hashtable();
		
		for (int i=0;i<count;i++)
		{
			Thread t = tarray[i];
			
			String s = t.getName();
			int j = s.indexOf(' ');
			if (false) //(j != -1)
			{
				String key = s.substring(0, j);
				Integer k = counts.get(key);
				if (k == null) k = 1;
				else k++;
				counts.put(key,  k);
			}
			else if (!t.getName().equals("No work"))
			{
				StackTraceElement[] stea = map.get(t);
				if (stea.length>1) ps.println(t+" "+stea[1]);
				else if (stea.length>0) ps.println(t+" "+stea[0]);
				else ps.println(t);
			}
		}

		ps.println("-----------------------------------------");
		ps.println("- Number of threads: "+count);

		Enumeration<String> ee = counts.keys();
		while (ee.hasMoreElements()) 
		{
			String key = ee.nextElement();
			Integer val = counts.get(key);
			ps.println("- "+key+": "+val);
		}

		ps.println("-----------------------------------------");
		ps.println("- waiting / available / total / maximum -");

		int wait = 0;
		int avail = 0;
		int total = 0;
		int max = 0;
		ByteArrayOutputStream baos2 = new ByteArrayOutputStream();
		PrintStream ps2 = new PrintStream(baos2);
		Enumeration<ThreadHandler> eee = mThreadHandlers.elements();
		while (eee.hasMoreElements())
		{
			ThreadHandler th = eee.nextElement();
			int w = th.waiting();
			int a = th.available();
			int t = th.size();
			int m = th.mMaxThreads;
			ps2.println("- "+th.mName+" "+w+"/"+a+"/"+t+"/"+m);
			wait += w;
			avail += a;
			total += t;
			max += m;
		}
		ps2.close();

		ps.println("-----------------------------------------");
		ps.println("- All Thread Handlers: "+wait+"/"+avail+"/"+total+"/"+max);
		ps.println("-----------------------------------------");
		ps.println(new String(baos2.toByteArray()));
		ps.println("---------------- THREADS ----------------");
		ps.close();

		return new String(baos.toByteArray());
	}
}




/*
int notask = 0;
int nowork = 0;
int nojob = 0;
int botbase = 0;
int http = 0;
int httpwait = 0;

if (t.getName().equals("No task")) notask++;
else if (t.getName().equals("No work")) nowork++;
else if (t.getName().equals("No job")) nojob++;
else
{
	StackTraceElement[] stea = m.get(t);
	if (t.getName().equals("HTTP")) 
	{ 
		if (stea.length>0 && stea[0].toString().startsWith("java.lang.Object.wait(")) httpwait++;
		else http++; 
	}
	else if (stea.length>1 && stea[0].toString().startsWith("java.lang.Object.wait(") && stea[1].toString().startsWith("com.newbound.thread.ThreadHandler$1.run")) botbase++;
	else if (stea.length>0) System.out.println(t+" "+stea[0]);
	else System.out.println(t);
//	if (stea[0].toString().startsWith("java.lang.Object"))
//	{
//		for (int j=0;j<stea.length;j++)
//			System.out.println(stea[j]);
//	}
}

System.out.println("-----------------------------------------");
System.out.println("-   notask: "+notask);
System.out.println("-   nowork: "+nowork);
System.out.println("-   nojob: "+nojob);
System.out.println("-   botbase: "+botbase);
System.out.println("-   http: "+http);
System.out.println("-   httpwait: "+httpwait);
*/						

