package com.newbound.util;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Enumeration;
import java.util.Vector;

import com.newbound.robot.BotUtil;

public class CompoundByteArray extends ByteArray
{
	protected Vector data = null;
	
	public CompoundByteArray()
	{
		super(new byte[] {});
		data = new Vector();
		length = 0;
		offset = 0;
	}

	public void write(OutputStream os) throws IOException
	{
		Enumeration e = data.elements();
		while (e.hasMoreElements())
		{
			ByteArray ba = (ByteArray)e.nextElement();
			ba.write(os);
		}
	}

	public int bytesToInt(int off)
	{
		int[] i = whichBA(off);
		ByteArray ba = (ByteArray)data.elementAt(i[0]);
		off = i[1];
		return ba.bytesToInt(off);
	}

	private int[] whichBA(int off)
	{
		int n = 0;
		int which = 0;

		Enumeration e = data.elements();
		while (e.hasMoreElements())
		{
			ByteArray ba = (ByteArray)e.nextElement();
			if (n + ba.length - offset <= off)
			{
				n += ba.length;
				which++;
			}
			else break;
		}

		int[] out = { which, off - n + offset};
		
		return out;
	}

	public long bytesToLong(int off)
	{
		int[] i = whichBA(off);
		ByteArray ba = (ByteArray)data.elementAt(i[0]);
		off = i[1];
		return ba.bytesToLong(off);
	}

	public float bytesToFloat(int off)
	{
		int[] i = whichBA(off);
		ByteArray ba = (ByteArray)data.elementAt(i[0]);
		off = i[1];
		return ba.bytesToFloat(off);
	}

	public String getStringValue(int off, int len)
	{
		return new String(getBytes(off, len));
	}

	public ByteArray child(int off)
	{
		return child(off, length-off);
	}

	public ByteArray child(int off, int len)
	{
		CompoundByteArray cba = new CompoundByteArray();
		int n = 0;

		Enumeration e = data.elements();
		while (e.hasMoreElements())
		{
			ByteArray ba = (ByteArray)e.nextElement();
			if (n + ba.length <= off)
			{
				n += ba.length;
			}
			else 
			{
				cba.add(ba);
				if (n<=off) cba.offset = off - n;
				if (off+len<=n+ba.length) break;

				n += ba.length;
			}
		}
		
		cba.length -= cba.offset;
		
		if (cba.data.size() == 1) 
		{
			return ((ByteArray)cba.data.firstElement()).child(cba.offset, len);
		}
		
		return cba;
	}

	public byte getByte(int off)
	{
		int[] i = whichBA(off);
		ByteArray ba = (ByteArray)data.elementAt(i[0]);
		off = i[1];

		return ba.getByte(off);
	}

	public InputStream getInputStream()
	{
		return new InputStream()
		{
			int isLen = 0;
			int isIndex = 0;
			InputStream mInputStream = null;

			public int read() throws IOException
			{
				if (isIndex >= isLen) return -1;
				
				prepIS(whichBA(isIndex));
				isIndex++;
				return mInputStream.read();
			}
			
			private void prepIS(int[] i) throws IOException
			{
				if (mInputStream == null || isIndex == isLen)
				{
					ByteArray ba = (ByteArray)data.elementAt(i[0]);
					isLen += ba.length;
					mInputStream = ba.getInputStream();
					if (isIndex == 0) 
					{
						isLen -= offset;
						mInputStream.skip(offset);
					}
				}
			}

			public int available() throws IOException
			{
				prepIS(whichBA(isIndex));
				return length - isIndex;
			}

			public int read(byte[] b, int off, int len) throws IOException
			{
				int[] i = whichBA(isIndex);
				prepIS(i);
				int n = mInputStream.read(b, off, len);
				if (n>0) isIndex += n;
				
				return n;
			}

			public long skip(long n) throws IOException
			{
				n = Math.min(length-isIndex, n);
				isIndex += n;
				return n;
			}
			
		};
	}

	public byte[] getBytes(int off, int len)
	{
		try
		{
			byte[] ba = new byte[len];
			
			InputStream is = (off == 0 && len == length) ? getInputStream() : child(off, len).getInputStream();
			BotUtil.read(is, ba, 0, len);
			is.close();

			return ba;
		}
		catch (Exception x)
		{
			x.printStackTrace();
			return null;
		}
	}

	public void add(ByteArray ba)
	{
		data.addElement(ba);
		length += ba.length;
	}

	public void add(byte[] ba)
	{
		add(new ByteArray(ba));
	}
	
	
	public static void main(String[] args)
	{
		CompoundByteArray cba = new CompoundByteArray();
		cba.add(("I am the very model ").getBytes());
		cba.add(("of a ").getBytes());
		cba.add(("modern major ").getBytes());
		cba.add(("general.").getBytes());
		
		ByteArray ba1 = cba.child(0, 15);
		System.out.println(new String(ba1.getBytes()));
		ByteArray ba2 = cba.child(15);
		System.out.println(new String(ba2.getBytes()));

		cba = new CompoundByteArray();
		cba.add(ba2);
		cba.add(ba1);
		
		System.out.println(new String(cba.getBytes()));
	}
	
	public String toString()
	{
		String s = "";
		
		int i = 0;
		Enumeration e = data.elements();
		while (e.hasMoreElements())
		{
			ByteArray ba = (ByteArray)e.nextElement();
			s += ba.toString();
			if (i++ == 0) s = s.substring(offset);
		}
		return s;
	}
	
	
	

}
