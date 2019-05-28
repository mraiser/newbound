package com.newbound.util;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import com.newbound.robot.BotUtil;

public class DataSet
{
	public DataProperty mFirstProperty = null;
	public DataProperty mLastProperty = null;
	public int mNumProperties = 0;
	
	public DataSet()
	{
		super();
	}

	public DataSet(InputStream is) throws IOException
	{
		super();
		read(is);
	}

	public String toString()
	{
		try
		{
			ByteArrayOutputStream baos = new ByteArrayOutputStream();
			writeXML(baos);
			baos.flush();
			baos.close();
			
			return baos.toString();
		}
		catch (Exception x) { x.printStackTrace(); }
		
		return "ERROR";
	}
	
	public void write(OutputStream os) throws IOException
	{
		os.write(mNumProperties);
		
		DataProperty dp = mFirstProperty;
		while (dp != null)
		{
			dp.write(os);
			dp = dp.getNextProperty();
		}
	}

	public void read(InputStream is) throws IOException
	{
		mFirstProperty = mLastProperty = null;

		int i = mNumProperties = is.read();
		while (i-->0)
		{
			DataProperty dp;
			if (mFirstProperty == null) dp = mFirstProperty = mLastProperty = new DataProperty();
			else 
			{
				dp = new DataProperty();
				mLastProperty.setNextProperty(dp);
				mLastProperty = dp;
			}

			dp.read(is);
			
		}
	}


	public int read(ByteArray byteArray) 
	{
		mFirstProperty = mLastProperty = null;

		int i = mNumProperties = byteArray.getByte(0);
		int off = 1;
		while (i-->0)
		{
			DataProperty dp;
			if (mFirstProperty == null) dp = mFirstProperty = mLastProperty = new DataProperty();
			else 
			{
				dp = new DataProperty();
				mLastProperty.setNextProperty(dp);
				mLastProperty = dp;
			}

			off += dp.read(byteArray.child(off));
		}
		
		return off;
	}

	public boolean hasDataProperty(String name)
	{
		return hasDataProperty(DataProperty.lookupProperty(name));
	}
	
	public boolean hasDataProperty(int i)
	{
		DataProperty dp = mFirstProperty;
		
		while (dp != null)
		{
			if (dp.mID == i) return true;
			dp = dp.getNextProperty();
		}
		
		return false;
	}
	
	public DataProperty getDataProperty(String name)
	{
		return getDataProperty(DataProperty.lookupProperty(name));
	}
	
	public DataProperty getDataProperty(int i)
	{
		DataProperty dp = mFirstProperty;
		
		while (dp != null)
		{
			if (dp.mID == i) return dp;
			dp = dp.getNextProperty();
		}
		if (dp == null)
		{
			dp = new DataProperty();
			dp.mID = i;
			if (mLastProperty == null) mFirstProperty = mLastProperty = dp;
			else
			{
				mLastProperty.setNextProperty(dp);
				mLastProperty = dp;
			}
			mNumProperties++;
		}
		
		return dp;
	}

	public void writeXML(OutputStream os) throws IOException
	{
		DataProperty dp = mFirstProperty;
		while (dp != null)
		{
			dp.writeXML(os); 
			dp = dp.getNextProperty();
		}
	}

	public void removeDataProperty(int i)
	{
		DataProperty dp1 = null;
		DataProperty dp2 = mFirstProperty;
		
		while (dp2 != null)
		{
			if (dp2.mID == i) 
			{
				if (dp1 == null) 
				{
					mFirstProperty = dp2.mNextProperty;
					if (dp2.mNextProperty == null) mLastProperty = mFirstProperty;
				}
				else 
				{
					dp1.mNextProperty = dp2.mNextProperty;
					if (dp2.mNextProperty == null) mLastProperty = dp1;
				}
				
				mNumProperties--;
				return;
			}
			else
			{
				dp1 = dp2;
				dp2 = dp2.mNextProperty;
			}
		}
	}

	public ByteArray toByteArray()
	{
		CompoundByteArray cba = new CompoundByteArray();
		byte[] ba = { (byte)mNumProperties };
		cba.add(new ByteArray(ba));

		DataProperty dp = mFirstProperty;
		while (dp != null)
		{
			cba.add(dp.toByteArray());
			dp = dp.getNextProperty();
		}

		return cba;
	}

	protected void setDataProperty(String key, DataProperty dp)
	{
		if (hasDataProperty(key))
		{
			DataProperty d = getDataProperty(key);
			d.mType = dp.mType;
			d.mValue = dp.mValue;
		}
		else
		{
			if (mFirstProperty == null) mFirstProperty = mLastProperty = dp;
			else mLastProperty = mLastProperty.mNextProperty = dp;
			mNumProperties++;
		}
	}
}
