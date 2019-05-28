package com.newbound.util;

/**
 *	FILE:
 *		Queue.java
 *	
 *	COPYRIGHT:
 *		? 1997, EveryDay Objects, Inc., all rights reserved.
 *		This source code or the object code resulting from
 *		compilation of said source may not be sold or
 *		distributed in any form without permission of EveryDay
 *		Objects, Inc.
 *	
 *	DESCRIPTION:
 *		Class which implements a queue - FIFO structure.
 *		Taken from Industrial Strength Java, pg. 252-256.
 *	
 *	CHANGE HISTORY:
 *		97.10.28   dea   Created file.
 */

public class Queue
{
	private Node   head = null;
	private Node   tail = null;

	private Object mPushMutex = new Object();
	/**
	 * This method pops an object off the top of the queue and returns
	 * it.  If there are no objects in the queue, the calling thread
	 * blocks until the queue is non-empty or until the timeout period
	 * has elapsed
	 *
	 * @return Object The object popped from the queue or null if timeout.
	 *
	 * @param timeout long
	 * 
	 * @exception NoSuchNodeException, InterruptedException
	 */
	public Object blockingPop(long timeout)
		throws NoSuchNodeException // , InterruptedException
	{
//		System.out.println("***BP*** Starting to blockingPop...");
//		IUtil.printStackTrace(5);
		
	    long stopTime = System.currentTimeMillis() + timeout;
	    long waitLen = timeout; 
	    
//		Node temp = null;

		synchronized (mPushMutex) 
		{
//			System.out.println("***BP*** Inside Synchronized...");

			while (head == tail) try
			{
				if (timeout != 0) 
				{
					waitLen = stopTime - System.currentTimeMillis();
					if (stopTime <= 0) return null;
				}

				 mPushMutex.wait(waitLen);
			}
			catch (InterruptedException x) 
			{ 
//				System.out.println("***BP*** Got Interrupted..."); 
				return null; 
			}

//			System.out.println("***BP*** Got Notified...");
//			IUtil.printStackTrace(5);
			
			return pop();
		}
	}
	/**
	 * This method pops an object off the top of the queue and returns
	 * it.  If there are no objects in the queue, the calling thread
	 * blocks until the queue is non-empty.
	 *
	 * @return Object The object popped from the queue.
	 * @exception NoSuchNodeException, InterruptedException
	 */
	public Object blockingPop()
		throws NoSuchNodeException // , InterruptedException
	{
		return blockingPop(0);
	}
	/**
	 * Deletes an object from the queue.
	 * @param objToDelete The object to be deleted.
	 */
	public synchronized void delete(Object objToDelete)
		throws NoSuchNodeException
	{
	Node dummyNode0 = head;
	Node dummyNode1 = head;
	Node dummyNode2 = head.getNextNode();
	
	if (objToDelete.equals(head.getObject()))
	{
			head = head.getNextNode();
			return;
	}
	
	while (!objToDelete.equals(dummyNode1.getObject()) &&
			   (dummyNode2 != tail))
	{
			dummyNode0 = dummyNode1;
			dummyNode1 = dummyNode2;
			dummyNode2 = dummyNode2.getNextNode();
	}
	
	if (objToDelete.equals(dummyNode1.getObject()))
	{
			dummyNode0.setNextNode(dummyNode2);
	}
	else if (objToDelete.equals(dummyNode1.getNextNode().getObject()))
	{
			dummyNode1 = tail;
	}
	else
	{
			throw new NoSuchNodeException("delete cannot happen, node DNE",
										  this);
	}
	}
	/**
	 * Find the Object in this Queue.
	 * @return int
	 * @param objToFind java.lang.Object
	 * @exception jserve.util.NoSuchNodeException The exception description.
	 */
	public synchronized int find(Object objToFind) throws NoSuchNodeException
	{
	int counter = 1;
	Node dummyNode = head;
	
	while (!objToFind.equals(dummyNode.getObject()))
	{
			counter++;
			if (dummyNode != tail)
			{
				dummyNode = dummyNode.getNextNode();
			}
			else
			{
				throw new NoSuchNodeException("find cannot happen, node DNE",
											  this);
			}
	}
	return counter;
	}
	/**
	 * This method returns true if the queue is empty.
	 * @return boolean
	 */
	public boolean isEmpty()
	{
	return (head == tail);
	}
	/**
	 * Construct a new Queue and put Object o in it
	 * @param o java.lang.Object
	 */
	public Queue(Object o)
	{
	this();
	push(o);
	}
	// Main entry point
	static public void main(String[] args) 
	{
		final Queue queue = new Queue();
		
		Runnable t1 = new Runnable()
		{
			public void run()
			{
				try
				{
					System.out.println("Waiting...");
					Object o = queue.blockingPop(0);
					System.out.println("Got: "+o);
				}
				catch (Exception x) { x.printStackTrace(); System.out.println(x); }
			}
		};
		
		Runnable t2 = new Runnable()
		{
			public void run()
			{
				System.out.println("Pushing...");
				queue.push("BOO!");
				System.out.println("Done Pushing...");
			}
		};

		new Thread(t1).start();

		try { Thread.sleep(2000); }
		catch (Exception x) { System.out.println(x); }

		new Thread(t2).start();
	}
	/**
	 * This method returns an object off the queue but does not remove it.
	 * @return Object The object peeked from the queue.
	 * @exception NoSuchNodeException
	 */
	public synchronized Object peek() throws NoSuchNodeException
	{
	if (head == tail)
	{
			throw new NoSuchNodeException("queue empty", this);
	}
	return head.getObject();
	}
	/**
	 * This method pops an object off the top of the queue and returns it.
	 * @return Object The object popped from the queue.
	 * @exception NoSuchNodeException
	 */
	public synchronized Object pop() throws NoSuchNodeException
	{
	Node temp = null;
	
	if (head == tail)
	{
			throw new NoSuchNodeException("queue empty", this);
	}
	else
	{
			temp = head;
			head = head.getNextNode();
	}
	return temp.getObject();
	}
	/**
	 * This method pushes an object onto the end of the queue.
	 * @param o The object to store in the queue.
	 */
	public synchronized void push(Object o)
	{
	Node temp       = tail;
		Node old_tail   = tail;
	tail = new Node(null, null);
	temp.setObject(o);
	temp.setNextNode(tail);

//	System.out.println("###PU### About to push...");
//	IUtil.printStackTrace(5);
	

		// If it was empty, then notify
		if (head == old_tail)
			synchronized (mPushMutex) { mPushMutex.notify(); }

//			System.out.println("###PU### Done Pushing...");
	}
	/**
	 * This method was created by a SmartGuide.
	 * @return int
	 */
	public int size ( ) 
	{
	try { return find(tail); }
	catch (NoSuchNodeException e) {}
	catch (NullPointerException e) {}
	
	return 0;
	}
	/**
	 * Basic Constructor
	 */
	public Queue()
	{
	head = new Node(null, null);
	tail = head;
	}
}
