package com.newbound.util;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;

import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.robot.BotUtil;

public class DataObject extends DataSet 
{
	public DataObject(InputStream is) throws IOException 
	{
		super(is);
	}

	public DataObject() 
	{
		super();
	}

	public DataObject(JSONObject code) 
	{
		Iterator<String> keys = code.keys();
		while (keys.hasNext()) try
		{
			String key = keys.next();
			Object val = code.get(key);
			if (val instanceof JSONObject) val = new DataObject((JSONObject)val);
			else if (val instanceof JSONArray) val = new DataList((JSONArray)val);
			put(key, val);
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	public Iterator<String> keys() 
	{
		return new Iterator<String>() 
		{
			DataProperty current = null;
			
			@Override
			public boolean hasNext() 
			{
				if (current == null) return mFirstProperty != null;
				return current.mNextProperty != null;
			}

			@Override
			public String next() 
			{
				if (current == null) current = mFirstProperty;
				else current = current.mNextProperty;
				return DataProperty.lookupPropertyString(current.mID);
			}

			@Override
			public void remove() 
			{
				removeDataProperty(current.mID);
			}
		};
	}

	public void put(String key, Integer val)
	{
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_INT, BotUtil.intToBytes((Integer)val))); 
	}
	
	public void put(String key, Long val)
	{
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_LONG, BotUtil.longToBytes((Long)val))); 
	}
	
	public void put(String key, Float val)
	{
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_FLOAT, BotUtil.floatToBytes((Float)val))); 
	}
	
	public void put(String key, Boolean val)
	{
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_BOOLEAN, val ? new byte[]{ 1 } : new byte[]{ 0 })); 
	}
	
	public void put(String key, String val)
	{
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_STRING, val.getBytes())); 
	}
	
	public void put(String key, DataObject val)
	{
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_DATA, val.toByteArray())); 
	}
	
	public void put(String key, DataList val)
	{
		setDataProperty(key, new DataProperty(DataProperty.lookupProperty(key), DataProperty.TYPE_LIST, val.toByteArray())); 
	}

	public boolean has(String name) 
	{
		return hasDataProperty(name);
	}

	public String getString(String name) 
	{
		return getDataProperty(name).getStringValue();
	}

	public boolean getBoolean(String name) 
	{
		return getDataProperty(name).getBooleanValue();
	}

	public int getInt(String name) 
	{
		return getDataProperty(name).getIntValue();
	}

	public long getLong(String name) 
	{
		return getDataProperty(name).getLongValue();
	}

	public float getFloat(String name) 
	{
		return getDataProperty(name).getFloatValue();
	}

	public DataObject getDataObject(String name) 
	{
		return getDataProperty(name).getDataObjectValue();
	}

	public DataList getDataList(String name) 
	{
		return getDataProperty(name).getDataListValue();
	}

	public Object get(String name) 
	{
		DataProperty dp = getDataProperty(name);
		if (dp.mType == DataProperty.TYPE_INT) return getInt(name);
		if (dp.mType == DataProperty.TYPE_LONG) return getLong(name);
		if (dp.mType == DataProperty.TYPE_FLOAT) return getFloat(name);
		if (dp.mType == DataProperty.TYPE_BOOLEAN) return getBoolean(name);
		if (dp.mType == DataProperty.TYPE_STRING) return getString(name);
		if (dp.mType == DataProperty.TYPE_DATA) return getDataObject(name);
		if (dp.mType == DataProperty.TYPE_LIST) return getDataList(name);
		
		throw new RuntimeException("Unknownn data type: "+name);
	}

	public void put(String key, Object val) 
	{
		if (val instanceof Integer) put(key, (Integer)val);
		else if (val instanceof Long) put(key, (Long)val);
		else if (val instanceof Float) put(key, (Float)val);
		else if (val instanceof Boolean) put(key, (Boolean)val);
		else if (val instanceof String) put(key, (String)val);
		else if (val instanceof DataObject) put(key, (DataObject)val);
		else if (val instanceof DataList) put(key, (DataList)val);
		else throw new RuntimeException("Unknown data type: "+val.getClass().getName());
	}

	
	public JSONObject toJSON() 
	{
		JSONObject jo = new JSONObject();
		Iterator<String> keys = keys();
		while (keys.hasNext()) try
		{
			String key = keys.next();
			Object val = get(key);
			if (val instanceof DataObject) val = ((DataObject)val).toJSON();
			else if (val instanceof DataList) val = ((DataList)val).toJSON();
			jo.put(key, val);
		}
		catch (Exception x) { x.printStackTrace(); }

		return jo;
	}

	public String toString()
	{
		return toJSON().toString();
	}

	public static void main(String[] args) 
	{
		try {
			JSONObject in = new JSONObject("{a:-2,b:4,c:{d:5}}");
			DataObject d = new DataObject(in);
			System.out.println(d);
		}
		catch (Exception x) { x.printStackTrace(); }
	}

}
