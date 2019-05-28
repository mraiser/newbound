package com.newbound.util;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Hashtable;
import java.util.Vector;

import com.newbound.robot.BotUtil;

public class DataProperty
{
	private static Hashtable<String, Integer> mTypeLookup = new Hashtable();
	private static Vector<String> mTypes = new Vector();
	private static Hashtable<String, Integer> mPropLookup = new Hashtable();
	private static Vector<String> mProps = new Vector();
	
	public static final int TYPE_DATA = -10;
	public static final int TYPE_LIST = -11;
	
	public static final int TYPE_RAW = lookupType(byte[].class.getName());
	public static final int TYPE_INT = lookupType(int.class.getName());
	public static final int TYPE_LONG = lookupType(long.class.getName());
	public static final int TYPE_FLOAT = lookupType(float.class.getName());
	public static final int TYPE_BOOLEAN = lookupType(boolean.class.getName());
	public static final int TYPE_STRING = lookupType(String.class.getName());

	protected int mID = -1;
	protected int mType = -1;
	protected ByteArray mValue = null;
	protected DataProperty mNextProperty = null;
	
	public DataProperty()
	{
		super();
	}

	protected static int lookupType(String name) 
	{
		Integer i = mTypeLookup.get(name);
		if (i == null) try
		{
			i = mTypes.size();
			mTypes.addElement(name);
			mTypeLookup.put(name, i);
		}
		catch (Exception x)
		{
			x.printStackTrace();
			i = -1;
		}

		return i;
	}

	protected static String lookupTypeString(int i)
	{
		return mTypes.elementAt(i);
	}

	protected static int lookupProperty(String name) 
	{
		Integer i = mPropLookup.get(name);
		if (i == null) try
		{
			i = mProps.size();
			mProps.addElement(name);
			mPropLookup.put(name, i);
		}
		catch (Exception x)
		{
			x.printStackTrace();
			i = -1;
		}

		return i;
	}

	protected static String lookupPropertyString(int i)
	{
		return mProps.elementAt(i);
	}

	public DataProperty(int id, int type, byte[] value)
	{
		this(id, type, new ByteArray(value));
	}

	public DataProperty(int id, int type, ByteArray value)
	{
		this();
		
		mID = id;
		mType = type;
		mValue = value;
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
		os.write(BotUtil.intToBytes(mType));
		os.write(BotUtil.intToBytes(mID));
		os.write(BotUtil.intToBytes(mValue.length));
		mValue.write(os);
	}

	public void read(InputStream is) throws IOException
	{
		byte[] iba = new byte[4];
		
		BotUtil.read(is, iba, 0, 4);
		mType = BotUtil.bytesToInt(iba, 0);
			
		BotUtil.read(is, iba, 0, 4);
		mID = BotUtil.bytesToInt(iba, 0);

		BotUtil.read(is, iba, 0, 4);
		int i = BotUtil.bytesToInt(iba, 0);
		
		byte[] ba = new byte[i];
		BotUtil.read(is, ba, 0, i);
		
		mValue = new ByteArray(ba);
		
//		System.out.print(">>> ");
//		System.out.print(lookupTypeString(iType)+" ");
//		System.out.print(lookupPropertyString(iID) + " ");
//		System.out.print(iValue.length);
//		System.out.print(" "+ getValueAsString());
//		System.out.println();
	}

	public int read(ByteArray ba)
	{
		mType = ba.bytesToInt(0);
		mID = ba.bytesToInt(4);
		int i = ba.bytesToInt(8);
		
		mValue = ba.child(12, i);
		
		return 12 + i;
	}

	public DataProperty getNextProperty()
	{
		return mNextProperty;
	}

	public void setNextProperty(DataProperty dp)
	{
		mNextProperty = dp;
	}

	public int getIntValue()
	{
		return mValue.bytesToInt(0);
	}

	public long getLongValue()
	{
		return mValue.bytesToLong(0);
	}

	public double getDoubleValue()
	{
		return mValue.bytesToDouble(0);
	}

	public float getFloatValue()
	{
		return mValue.bytesToFloat();
	}

	public boolean getBooleanValue()
	{
		return mValue.getBooleanValue();
	}

	public String getStringValue()
	{
		return mValue.getStringValue();
	}

	public DataObject getDataObjectValue()
	{
		return mValue.getDataObjectValue();
	}

	public DataList getDataListValue()
	{
		return mValue.getDataListValue();
	}

	public void setValue(int val)
	{
		setValue(TYPE_INT, BotUtil.intToBytes(val));
	}

	public void setValue(long val)
	{
		setValue(TYPE_LONG, BotUtil.longToBytes(val));
	}

	public void setValue(double val)
	{
		setValue(TYPE_LONG, BotUtil.doubleToBytes(val));
	}

	public void setValue(float f)
	{
		setValue(TYPE_FLOAT, BotUtil.floatToBytes(f));
	}
	
	public void setValue(boolean b)
	{
		setValue(TYPE_BOOLEAN, b ? new byte[]{ 1 } : new byte[]{ 0 } );
	}
	
	public void setValue(String val)
	{
		setValue(TYPE_STRING, val.getBytes());
	}

	public void setValue(DataObject val)
	{
		setValue(TYPE_DATA, val.toByteArray());
	}

	public void setValue(DataList val)
	{
		setValue(TYPE_LIST, val.toByteArray());
	}

	public void setValue(DataProperty val)
	{
		try { setValue(val.mType, val.toByteArray()); } catch (Exception x) { x.printStackTrace(); }
	}

	public void setValue(int type, ByteArray data)
	{
		mType = type;
		mValue = data;
	}

	public void setValue(int type, byte[] data)
	{
		mType = type;
		mValue = new ByteArray(data);
	}

	public ByteArray getValue()
	{
		return mValue;
	}

	public void writeXML(OutputStream os) throws IOException
	{
		String type = lookupTypeString(mType);
		String id = lookupPropertyString(mID);
		os.write(("<"+id+" TYPE='"+type+"'>").getBytes());
		
		if (mType == TYPE_RAW)
		{
			String s = BotUtil.toHexString(mValue.getBytes());
			os.write(s.getBytes());
		}
		else 
//			if ((mType < TYPE_COMMAND) || (mType == TYPE_BOOLEAN) || (mType == TYPE_LONG)) 
				os.write(getValueAsString().getBytes());
/*
		else
		{
			MMOGData md = new MMOGData(mMMOGEnvironment) { public void getAllProperties(){} public void setAllProperties() {} };
			md.update(mValue);
			md.writeXML(os);
		}
*/
		os.write(("</"+id+">\r\n").getBytes());
	}

	public String getValueAsString()
	{
		String s;
		
//		if (mType == TYPE_STRING) s = mValue.getStringValue();
//		else 
			if (mType == TYPE_INT) s = ""+getIntValue();
		else if (mType == TYPE_LONG) s = ""+getLongValue();
		else if (mType == TYPE_FLOAT) s = ""+getFloatValue();
		else if (mType == TYPE_BOOLEAN) s = ""+getBooleanValue();
		else if (mType == TYPE_DATA) s = getDataObjectValue().toString();
		else if (mType == TYPE_LIST) s = getDataListValue().toString();
		else
			s = mValue.getStringValue(); /*
		{
			MMOGData md = new MMOGData(mMMOGEnvironment) { public void getAllProperties(){} public void setAllProperties() {} };
			md.update(mValue);
			s = MMOGDataTypeLookup.lookupTypeString(md.mType) + "/" + md.mID;
		}
*/		
		return s;
	}

	public ByteArray toByteArray()
	{
		CompoundByteArray cba = new CompoundByteArray();
		
		cba.add(BotUtil.intToBytes(mType));
		cba.add(BotUtil.intToBytes(mID));
		cba.add(BotUtil.intToBytes(mValue.length));
		cba.add(mValue);
		
		return cba;
	}
}
