package com.newbound.util;

/**
 *	FILE:
 *		Node.java
 *	
 *	COPYRIGHT:
 *		? 1997, EveryDay Objects, Inc., all rights reserved.  This source code or
 *		the object code resulting from compilation of said source may not be sold
 *		or distributed in any form without permission of EveryDay Objects, Inc.
 *	
 *	DESCRIPTION:
 *		Class which implements a node.  Taken from Industrial Strength Java, pg.237-239.
 *		Used by Queue
 *	
 *	CHANGE HISTORY:
 *		97.10.28   dea   Created file.
 */

public class Node
{
	private Node     nextNode;
	private Object   value;		// The object for this node.


/**
 * Basic Constructor
 */
public Node()
{
}
/**
 * Construct a new instance of Node with next Node n for Object o.
 * @param n jserve.util.Node
 * @param o java.lang.Object
 */
public Node(Node n, Object o)
{
	nextNode = n;
	value    = o;
}
/**
 * This method returns the next linked node.
 * @return Node
 * @exception jserve.util.NoSuchNodeException  There is no such node.
 */
public Node getNextNode() throws NoSuchNodeException
{
	if (nextNode == null)
	{
		throw new NoSuchNodeException("get next node", this);
	}
	return nextNode;
}
/**
 * This method returns the runnable object from the next linked node.
 * @return Node
 * @exception jserve.util.NoSuchNodeException  There is no such node.
 */
public Object getNextObject() throws NoSuchNodeException
{
	if (nextNode == null)
	{
		throw new NoSuchNodeException("get next object", this);
	}
	return (nextNode.getObject());
}
/**
 * Returns the value of this node.
 * @return Object
 */
public Object getObject()
{
	return value;
}
/**
 * Returns true if the value of the next node is null.
 * @return boolean
 */
public boolean isNextNull()
{
	return (nextNode == null);
}
/**
 * Sets the next linked node.
 * @param n
 */
public void setNextNode(Node n)
{
	nextNode = n;
}
/**
 * Sets the object for the next linked node.
 * @param r
 * @exception jserve.util.NoSuchNodeException  There is no such node.
 */
public void setNextObject(Object o) throws NoSuchNodeException
{
	if (nextNode == null)
	{
		throw new NoSuchNodeException("set next object", this);
	}
	nextNode.setObject(o);
}
/**
 * Sets the value of this node.
 * @param o
 */
public void setObject(Object o)
{
	value = o;
}
}