package com.newbound.util;

/**
 *	FILE:
 *		NoSuchNodeException.java
 *	
 *	COPYRIGHT:
 *		? 1997, EveryDay Objects, Inc., all rights reserved.  This source code or
 *		the object code resulting from compilation of said source may not be sold
 *		or distributed in any form without permission of EveryDay Objects, Inc.
 *	
 *	DESCRIPTION:
 *		Class which implements a NoSuchNodeException.  Taken from Industrial Strength Java, pg. 234-235.
 *	
 *	CHANGE HISTORY:
 *		97.10.28   dea   Created file.
 */

public class NoSuchNodeException extends Exception
{
	public String name;
	public Object value;


/**
 * Construct a new instance of NoSuchNodeException.
 * @param n java.lang.String
 * @param o java.lang.Object
 */
public NoSuchNodeException(String n, Object o)
{
	super("Exception thrown due to: " + n);
	name = n;
	value = o;
}
}