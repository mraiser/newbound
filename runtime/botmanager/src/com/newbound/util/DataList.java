package com.newbound.util;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;

import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.robot.BotUtil;

public class DataList extends DataSet 
{
	public DataList(InputStream is) throws IOException 
	{
		super(is);
	}

	public DataList() 
	{
		super();
	}

	public DataList(JSONArray ja) 
	{
		int n = ja.length();
		int i;
		for (i=0;i<n;i++) try
		{
			Object val = ja.get(i);
			if (val instanceof JSONObject) val = new DataObject((JSONObject)val);
			else if (val instanceof JSONArray) val = new DataList((JSONArray)val);
			put(val);
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	public void put(Integer val)
	{
		String key = ""+mNumProperties;
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_INT, BotUtil.intToBytes((Integer)val))); 
	}
	
	public void put(Long val)
	{
		String key = ""+mNumProperties;
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_LONG, BotUtil.longToBytes((Long)val))); 
	}
	
	public void put(Float val)
	{
		String key = ""+mNumProperties;
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_FLOAT, BotUtil.floatToBytes((Float)val))); 
	}
	
	public void put(Boolean val)
	{
		String key = ""+mNumProperties;
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_BOOLEAN, val ? new byte[]{ 1 } : new byte[]{ 0 })); 
	}
	
	public void put(String val)
	{
		String key = ""+mNumProperties;
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_STRING, val.getBytes())); 
	}
	
	public void put(DataSet val)
	{
		String key = ""+mNumProperties;
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_STRING, val.toByteArray())); 
	}

	public int length() 
	{
		return mNumProperties;
	}

	public DataObject getDataObject(int i) 
	{
		return getDataProperty(""+i).getDataObjectValue();
	}

	public int getInt(int i) 
	{
		return getDataProperty(""+i).getIntValue();
	}

	public long getLong(int i) 
	{
		return getDataProperty(""+i).getLongValue();
	}

	public float getFloat(int i) 
	{
		return getDataProperty(""+i).getFloatValue();
	}

	public boolean getBoolean(int i) 
	{
		return getDataProperty(""+i).getBooleanValue();
	}

	public String getString(int i) 
	{
		return getDataProperty(""+i).getStringValue();
	}

	public DataList getDataList(int i) 
	{
		return getDataProperty(""+i).getDataListValue();
	}

	public void put(Object val) 
	{
		if (val instanceof Integer) put((Integer)val);
		else if (val instanceof Long) put((Long)val);
		else if (val instanceof Float) put((Float)val);
		else if (val instanceof Boolean) put((Boolean)val);
		else if (val instanceof String) put((String)val);
		else if (val instanceof DataObject) put((DataObject)val);
		else if (val instanceof DataList) put((DataList)val);
		else throw new RuntimeException("Unknownn data type: "+val.getClass().getName());
	}

	public Object get(int i) 
	{
		DataProperty dp = getDataProperty(""+i);
		if (dp.mType == DataProperty.TYPE_INT) return getInt(i);
		if (dp.mType == DataProperty.TYPE_LONG) return getLong(i);
		if (dp.mType == DataProperty.TYPE_FLOAT) return getFloat(i);
		if (dp.mType == DataProperty.TYPE_BOOLEAN) return getBoolean(i);
		if (dp.mType == DataProperty.TYPE_STRING) return getString(i);
		if (dp.mType == DataProperty.TYPE_DATA) return getDataObject(i);
		if (dp.mType == DataProperty.TYPE_LIST) return getDataList(i);
		
		throw new RuntimeException("Unknownn data type: "+i);
	}

	public JSONArray toJSON() 
	{
		JSONArray ja = new JSONArray();
		int n = length();
		int i;
		for (i=0;i<n;i++)
		{
			Object val = get(i);
			if (val instanceof DataObject) val = ((DataObject)val).toJSON();
			else if (val instanceof DataList) val = ((DataList)val).toJSON();
			ja.put(val);
		}
		return ja;
	}
}
