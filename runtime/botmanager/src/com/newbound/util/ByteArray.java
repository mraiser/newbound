package com.newbound.util;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import com.newbound.robot.BotUtil;

public class ByteArray
{
	private byte[] data = null;
	int offset = -1;
	
	public int length;
	
	public ByteArray(byte[] ba, int off, int len)
	{
		data = ba;
		offset = off;
		length = len;
	}

	public ByteArray(byte[] ba)
	{
		this(ba, 0, ba.length);
	}

	public void write(OutputStream os) throws IOException
	{
		os.write(data, offset, length);
	}

	public int bytesToInt()
	{
		return bytesToInt(0);
	}
	
	public int bytesToInt(int off)
	{
		return BotUtil.bytesToInt(data, offset+off);
	}

	public long bytesToLong()
	{
		return bytesToLong(0);
	}
	
	public long bytesToLong(int off)
	{
		return BotUtil.bytesToLong(data, offset+off);
	}

	public double bytesToDouble()
	{
		return bytesToDouble(0);
	}
	
	public double bytesToDouble(int off)
	{
		return BotUtil.bytesToDouble(data, offset+off);
	}

	public float bytesToFloat()
	{
		return bytesToFloat(0);
	}
	
	public float bytesToFloat(int off)
	{
		return BotUtil.bytesToFloat(data, offset+off);
	}

	public boolean getBooleanValue()
	{
		return getBooleanValue(0);
	}

	public boolean getBooleanValue(int off)
	{
		return getByte(off) == 1;
	}

	public String getStringValue()
	{
		return getStringValue(0, length);
	}

	public String getStringValue(int off, int len)
	{
		return new String(data, offset+off, len);
	}

	public DataObject getDataObjectValue()
	{
		return getDataObjectValue(0, length);
	}

	public DataObject getDataObjectValue(int off, int len)
	{
		try
		{
			ByteArrayInputStream baos = new ByteArrayInputStream(data, offset+off, len);
			return new DataObject(baos);
		}
		catch (IOException x)
		{
			x.printStackTrace();
			throw new RuntimeException(x.getMessage());
		}
	}

	public DataList getDataListValue()
	{
		return getDataListValue(0, length);
	}

	public DataList getDataListValue(int off, int len)
	{
		try
		{
			ByteArrayInputStream baos = new ByteArrayInputStream(data, offset+off, len);
			return new DataList(baos);
		}
		catch (IOException x)
		{
			x.printStackTrace();
			throw new RuntimeException(x.getMessage());
		}
	}

	public ByteArray child(int off)
	{
		return new ByteArray(data, offset+off, length-off);
	}

	public ByteArray child(int off, int len)
	{
		return new ByteArray(data, offset+off, len);
	}

	public byte getByte(int i)
	{
		return data[offset+i];
	}

	public InputStream getInputStream()
	{
		return new InputStream()
		{
			int index = 0;

			public int read() throws IOException
			{
				if (index == length) return -1;
				return data[offset + index++];
			}

			public int available() throws IOException
			{
				return length - index;
			}

			public int read(byte[] b, int off, int len) throws IOException
			{
				int n = Math.min(len, length - index);
				int i = offset+index;
				System.arraycopy(data, i, b, off, n);
				index += n;
				return n;
			}
			
			public long skip(long n) throws IOException
			{
				n = Math.min(length-index, n);
				index += n;
				return n;
			}
		};
	}

	public byte[] getBytes()
	{
		return getBytes(0, length);
	}
	
	public byte[] getBytes(int off, int len)
	{
		byte[] ba = new byte[length];
		System.arraycopy(data, offset+off, ba, 0, len);
		return ba;
	}
	
	public String toString()
	{
		return new String(data, offset, length);
	}
}
