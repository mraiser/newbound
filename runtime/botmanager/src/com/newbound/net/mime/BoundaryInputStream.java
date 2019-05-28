package com.newbound.net.mime;

import java.io.IOException;
import java.io.InputStream;

public class BoundaryInputStream extends InputStream
{
	protected InputStream mInputStream = null;
	protected String mBoundary = null;
	protected String mTail = null; 
	
	public BoundaryInputStream(InputStream is, String boundary) throws IOException
	{
		super();
		mInputStream = is;
		mBoundary = boundary;
		mTail = "";
		int i = mBoundary.length();
		while (i-->0) mTail += (char)mInputStream.read();
	}
	

	public int read() throws IOException
	{
		if (mTail.length() == 0) return -1;
		
		int out = mTail.charAt(0);
		mTail = mTail.substring(1);
		
		int i = mInputStream.read();
		if (i != -1) mTail += (char)i;
		
		if (mTail.equals(mBoundary)) mTail = "";
		
		return out;
	}
}
