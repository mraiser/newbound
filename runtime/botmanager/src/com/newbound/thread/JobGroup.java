/*
 * Created on May 31, 2005
 *
 * TODO To change the template for this generated file go to
 * Window - Preferences - Java - Code Style - Code Templates
 */
package com.newbound.thread;

import java.util.Vector;

/**
 * @author mraiser
 *
 * TODO To change the template for this generated type comment go to
 * Window - Preferences - Java - Code Style - Code Templates
 */
public class JobGroup
{
	private Object mMutex = new Object();
	
	protected boolean mDone = true;
	protected Vector mJobs = new Vector();
	protected String mName = "UNTITLED JOB GROUP";
	protected ThreadHandler mThreadHandler = null;
	protected JobRunner[] mActiveJobs = null;
	protected int mNumThreads = -1;
	
    class JobRunner implements Runnable
    {
       boolean iDone = false;
       Runnable iRunnable = null;
       JobGroup iJobGroup = null;
       
       JobRunner(Runnable r) { iRunnable = r; }

       public void run()
        {
            try { iRunnable.run(); }
            catch (Exception x) { x.printStackTrace(); }
            finally 
            { 
                iDone = true; 
                jobDone(this);
            }
        }
    }

	
	public JobGroup(String label, ThreadHandler th, int numthreads)
	{
		mName = label;
		mThreadHandler = th;
		mActiveJobs = new JobRunner[numthreads];
		mNumThreads = numthreads;
		while (numthreads-->0)
		{
			mActiveJobs[numthreads] = new JobRunner(null);
			mActiveJobs[numthreads].iDone = true;
		}
	}
	
	public void addJob(Runnable r)
	{
		synchronized (mMutex) { mJobs.addElement(r); }
		doNextJob();
	}
	
	public void doNextJob()
	{
		Runnable nextjob = null;

		synchronized(mMutex)
		{
			if (mJobs.size() > 0) 
			{
				nextjob = (Runnable)mJobs.elementAt(0);
				mJobs.removeElementAt(0);
				mDone = false;
			}
		
			int i = mActiveJobs.length;

			if (nextjob == null)
			{
				boolean checkdone = true;
				while (i-->0) if (!mActiveJobs[i].iDone) { checkdone = false; break; }
				mDone = checkdone;
			}
			else
			{
				while (i-->0)
				{
					if (mActiveJobs[i].iDone)
					{
						mActiveJobs[i].iRunnable = nextjob;
						mActiveJobs[i].iDone = false;
						mThreadHandler.addJob(mActiveJobs[i], mName+"_"+i);
						
						break;
					}
				}
			}
		}
	}
	
	public void jobDone(JobRunner jr)
	{
		doNextJob();
	}

	public boolean isDone()
	{
		return mDone;
	}
	
/*
    Enumeration mJobs = null;
    String mLabel = "Untitled Group";
    int mCount = 0;
    ThreadHandler mThreadHandler = null;
    int mNumJobs = 0;
    boolean mDone = false;
    Vector mWorkingJobs = new Vector();
    
    public boolean isDone()
    {
        if(mDone)
        {
            Vector v = new Vector();
            Enumeration e = mWorkingJobs.elements();
            while (e.hasMoreElements())
            {
                JobRunner jr = (JobRunner)e.nextElement();
                if (!jr.iDone) v.addElement(jr);
            }
            mWorkingJobs = v;
            if (mWorkingJobs.size() == 0) return true;
        }
        
        return false;
    }
    class JobRunner implements Runnable
    {
       boolean iDone = false;
       Runnable iRunnable = null;
       JobGroup iJobGroup = null;
        
       JobRunner(Runnable r) { iRunnable = r; }

       public void run()
        {
            try { iRunnable.run(); }
            catch (Exception x) { x.printStackTrace(); }
            finally 
            { 
                iDone = true; 
                doNext();
            }
        }
    }

    public JobGroup(Vector jobs, String label, ThreadHandler th)
    {
        mJobs = jobs.elements();
        mLabel = label;
        mThreadHandler = th;
        mNumJobs = jobs.size();
    }


    public boolean doNext()
    {
        synchronized (mJobs)
        {
	        if (mJobs.hasMoreElements())
	        {
	            System.out.println("JobGroup("+mLabel+") doing next");
	            JobRunner jr =  new JobRunner((Runnable)mJobs.nextElement());
	            mThreadHandler.addJob(jr,mLabel+" "+ ++mCount+"/"+mNumJobs);
	            mWorkingJobs.addElement(jr);
	            return true;
	        }
	        else 
	        {
	            System.out.println("JobGroup("+mLabel+") DONE");
	            mDone = true;
	            return false;
	        }
        }
    }
*/
}
