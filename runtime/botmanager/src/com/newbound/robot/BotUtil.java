package com.newbound.robot;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.CharArrayWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.URL;
import java.net.URLConnection;
import java.net.UnknownHostException;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Properties;
import java.util.UUID;
import java.util.Vector;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.util.NoDotFilter;

public class BotUtil 
{
	private static final String nonhexchars = "ghijklmnopqrstuvwxyz";
	
    public static boolean[] okChars = new boolean[256];
    static	{
        int i = 256;
        while (i-->0) okChars[i] = false;
        for (i = 'a'; i <= 'z'; i++) okChars[i] = true;
        for (i = 'A'; i <= 'Z'; i++) okChars[i] = true;
        for (i = '0'; i <= '9'; i++) okChars[i] = true;
    }	

    public static String readLine(InputStream reader, int maxlen) throws IOException
    {
        int count = 0;
        CharArrayWriter baos = new CharArrayWriter();
                
        while (true)
        {
	        int i = reader.read();
	        if (i == -1) break;
	        count++;
	        
	        if (i == '\r')
	        {
	            if (reader.markSupported())
	            {
	            	reader.mark(1);
	            	i = reader.read();
	            	if (i != '\n') reader.reset();
	            }
	            else
	            	System.out.println("SUPPRESSED CR POSSIBLE IF MISSING LF");
	        }
	        
	        if (i == '\n') break;
	        if (count > maxlen) 
	        {
	            throw new RuntimeException("Maximum buffer length exceded reading from InputStream");
	        }
	        
	        baos.write(i);
        }
        
        baos.close();
//        System.out.println(count);
        
        return count == 0 ? null : baos.toString();
    }

    public static long sendData(InputStream dataIS, OutputStream dataOS, int length, int chunkSize) throws Exception 
    {
    	return sendData(dataIS, dataOS, length, chunkSize, null);
    }
    
    public static long sendData(InputStream dataIS, OutputStream dataOS, int length, int chunkSize, Callback cb) throws Exception 
    {
    	OutputStream[] osa = { dataOS };
    	return sendData(dataIS, osa, length, chunkSize, cb);
    }

    public static long sendData(InputStream dataIS, OutputStream[] osa, int length, int chunkSize) throws Exception 
    {
    	return sendData(dataIS, osa, length, chunkSize, null);
    }
    
    public static long sendData(InputStream dataIS, OutputStream[] osa, int length, int chunkSize, Callback cb) throws Exception 
    {
    	long numbytes = 0;
    	if (length != -1) chunkSize = Math.min(length, chunkSize);
    	
    	JSONObject jo = null;
    	if (cb != null)
    	{
    		jo = new JSONObject();
    		jo.put("length", length);
    	}
    	
		// Send the data in chunks of mFileChunkSize bytes
		byte[] fileBuf = new byte[chunkSize];
		int i = 0;
	
		// As long as there's data available without blocking, send it
		// Then test to see if we're blocking by reading one character.
		// Repeat until there's no more data to send.
		int oneChar;
		while (length == -1 || numbytes < length)
		{
            i=dataIS.available();
		
            if (i > 1) 
            {
                if (i>chunkSize) i = chunkSize;
                if (length != -1 && numbytes+i>length) i = (int)(length - numbytes);
                int num = dataIS.read(fileBuf,0,i);
                int j = osa.length;
                while (j-->0) osa[j].write(fileBuf, 0, num);
                numbytes += num;
                
                if (jo != null)
                {
                	jo.put("sent", numbytes);
                	cb.execute(jo);
                }
            }
		
            if (length == -1 || numbytes < length) 
            {
            	oneChar = dataIS.read();
                if (oneChar == -1) 
                	break;
                int j = osa.length;
                while (j-->0) osa[j].write(oneChar);
                numbytes++;
                
                if (jo != null)
                {
                	jo.put("sent", numbytes);
                	cb.execute(jo);
                }                
            }
		
		}
		
        int j = osa.length;
        while (j-->0) osa[j].flush();
		
		return numbytes;
    }

    public static String hexEncode(String in) 
    {
		String out = "";
		char[] inArray = in.toCharArray();
		int i = inArray.length;
		while (i-->0)
		{
	        if (inArray[i] < 256)
	        {
                if (okChars[inArray[i]]) out = inArray[i]+out;
                else out = "%" + Integer.toHexString((inArray[i] >> 4) & 0xF) + Integer.toHexString(inArray[i] & 0xF) + out;
            }
	    }
		return out;
	}	

    public static String hexDecode(String in)
    {
	String old = in;
	String out = "";
	int hex;
	
	int i = 0;
//	int j = 0;
	
	do
	{
            if ((i = old.indexOf("%")) == -1) break;
            out = out + old.substring(0, i);
            old = old.substring(i);
            if (old.length()<3) break;
            hex = -1;
            try { hex = Integer.parseInt(old.substring(1,3), 16); } catch (Exception x) {}
            if (hex == -1)
            {
                out = out + old.substring(0,1);
                old = old.substring(1);
            }
            else
            {
                out = out + (char)hex;
                old = old.substring(3);
            }
	} 
	while (true);
	
	return out+old;
    }

	public static byte[] fromHex(String hex)
	{
		int n = hex.length();
		byte[] ba = new byte[n/2];
		int i = 0;
		int j = 0;
		while (i<n)
		{
			String s = hex.substring(i, i+2);
			ba[j++] = (byte)Integer.parseInt(s, 16);
			i += 2;
		}
		
		return ba;
	}

	public static Properties loadProperties(File f3) throws IOException
	{
		if (f3.exists())
		{
			FileInputStream fis = new FileInputStream(f3);
			Properties p = new Properties();
			p.load(fis);
			fis.close();
			
			return p;
		}
		return null;
	}
	
	public static void storeProperties(Properties p, File f) throws IOException
	{
		FileOutputStream fos = new FileOutputStream(f);
		p.store(fos, "");
		fos.flush();
		fos.close();
	}

    public static String padStringFront(String s, String d, int l) 
    {
		int j = s.length();
		if (j >= l) return s.substring(j-l, j);
	
		int i = 0;
		for (i=j; i<l; i++) s = d + s;
	
		return s;	
    }

	public static String toHex(char c)
	{
		return padStringFront(Integer.toHexString(0xFFFF & c), "0", 4);
	}
	
	public static String toHex(char[] ca)
	{
		String s = "";
		for (int i=0; i<ca.length; i++) s += toHex(ca[i]);
		return s;
	}

	public static String toHex(byte b)
	{
		return padStringFront(Integer.toHexString(0xFF & b), "0", 2);
	}
	
	public static String toHexString(byte[] b)
	{
		String s = "";
		for (int i=0; i<b.length; i++) s += toHex(b[i]);
		return s;
	}

	public static byte[] fromHexString(String hex)
	{
		int n = hex.length();
		byte[] ba = new byte[n/2];
		int i = 0;
		int j = 0;
		while (i<n)
		{
			String s = hex.substring(i, i+2);
			ba[j++] = (byte)Integer.parseInt(s, 16);
			i += 2;
		}
		
		return ba;
	}

	public static void copyFile(File f, File f2) throws Exception
	{
		copyFile(f,f2,true);
	}
	
	public static void copyFile(File f, File f2, boolean replace) throws Exception
	{
		if (replace || !f2.exists())
		{
			InputStream is = new FileInputStream(f);
			OutputStream os = new FileOutputStream(f2);
			sendData(is, os, (int)f.length(), 4096);
			os.flush();
			os.close();
			is.close();
		}
	}
	
	public static void copyFolder(File d1, File d2) throws Exception
	{
		copyFolder(d1,d2,true);
	}
	
	public static void copyFolder(File d1, File d2, boolean replace) throws Exception
	{
		d2.mkdirs();
		String[] list = d1.list();
		int i = list.length;
		while (i-->0)
		{
			File f1 = new File(d1, list[i]);
			File f2 = new File(d2, list[i]);
			if (f1.isDirectory()) copyFolder(f1, f2, replace);
			else copyFile(f1, f2, replace);
		}
	}

	public static void deleteDir(File src)
	{
		if (src.exists() && src.isDirectory())
		{
			String[] files = src.list();
			int i = files.length;
			while (i-->0)
			{
				File f1 = new File(src, files[i]);
				if (f1.isDirectory())
				{
					deleteDir(f1);
				}
	
				f1.delete();
			}
			src.delete();
		}
	}

    public static String lettersAndNumbersOnly(String in) 
    {
		String out = "";
		char[] inArray = in.toCharArray();
		int i = inArray.length;
		while (i-->0)
		{
		        if (inArray[i] < 256)
		        {
	                if (okChars[inArray[i]]) out = inArray[i]+out;
	            }
		}	
		
		return out;
    }

	public static long bytesToLong(byte[] b, int offset)
	{
        long value = 0;
        for (int i = 0; i < 8; i++) {
            int shift = (8 - 1 - i) * 8;
            value += ((long)(b[i + offset] & 0x000000FF)) << shift;
        }
        return value;
    }
	
	public static byte[] longToBytes(long val)
	{
	       byte[] b = new byte[8];
	        for (int i = 0; i < 8; i++) {
	            int offset = (b.length - 1 - i) * 8;
	            b[i] = (byte) ((val >>> offset) & 0xFF);
	        }
	        return b;
    }

	public static byte[] intToBytes(int val)
	{
	       byte[] b = new byte[4];
	        for (int i = 0; i < 4; i++) {
	            int offset = (b.length - 1 - i) * 8;
	            b[i] = (byte) ((val >>> offset) & 0xFF);
	        }
	        return b;
    }

	public static int bytesToInt(byte[] b, int offset)
	{
        int value = 0;
        for (int i = 0; i < 4; i++) {
            int shift = (4 - 1 - i) * 8;
            value += (b[i + offset] & 0x000000FF) << shift;
        }
        return value;
    }
	
	public static double bytesToDouble(byte[] b, int offset)
	{
		long accum = bytesToLong(b, offset);
		return Double.longBitsToDouble(accum);    
	}
	
	public static byte[] doubleToBytes(double val)
	{
		long l = Double.doubleToLongBits(val);
		return longToBytes(l);	
    }

	public static byte[] floatToBytes(float f)
	{
//		double d = (double)f;
		int i1 = (int)f;
		int i2 = (int)(Integer.MAX_VALUE * (f - (float)i1)); 
		
		byte[] ba3 = new byte[8];
		System.arraycopy(intToBytes(i1), 0, ba3, 0, 4);
		System.arraycopy(intToBytes(i2), 0, ba3, 4, 4);
		
		return ba3;
	}
	
	public static byte[] floatArrayToBytes(float[] fa)
	{
		int n = fa.length * 8;
		byte[] ba = new byte[n];
		while ((n -= 8) >= 0) {
			byte[] ba2 = floatToBytes(fa[n/8]);
			System.arraycopy(ba2, 0, ba, n, 8);
		}
		return ba;
	}

	public static float bytesToFloat(byte[] ba)
	{
		return bytesToFloat(ba, 0);
	}

	public static float bytesToFloat(byte[] ba, int off)
	{
		int i1 = bytesToInt(ba, off+0);
		int i2 = bytesToInt(ba, off+4);
		
		float f = (float)i1 + (float)i2/(float)Integer.MAX_VALUE;
		return f;
	}
	
	public static float[] bytesToFloatArray(byte[] ba)
	{
		int n = ba.length;
		float[] ia = new float[n/8];
		while ((n -= 8) >= 0) ia[n/8] = bytesToFloat(ba, n);		
		return ia;
	}

	public static void read(InputStream is, byte[] ba, int off, int len) throws IOException
	{
		int n = 0;
		while (n<len)
		{
			int m = is.read(ba, off+n, len-n);
			if (m<1) throw new IOException("END OF STREAM");
			n += m;
		}
	}

	@Deprecated
	public static String getHeader(Hashtable<String, Object> headers, String string) 
	{
		Object o = headers.get(string.toUpperCase());
		String s;
		if (o instanceof Vector)
		{
			s = (String)((Vector<String>)o).firstElement();
		}
		else s = (String)o;
		
		return s;
	}

	public static String[] systemCall(String call) throws IOException
    {
        return systemCall(call, (InputStream)null);
    }

	public static String[] systemCall(String call, long timeoutmillis) throws IOException
    {
        return systemCall(call, (InputStream)null, timeoutmillis);
    }

	public static String[] systemCall(String[] call) throws IOException
    {
        return systemCall(call, (InputStream)null);
    }

	public static String[] systemCall(String[] call, long timeoutmillis) throws IOException
    {
        return systemCall(call, (InputStream)null, timeoutmillis);
    }

    public static String[] systemCall(String call, File f) throws IOException
    {
        FileInputStream fr = new FileInputStream(f);
   		return systemCall(call, fr);
    }

    public static String[] systemCall(String call, File f, long timeoutmillis) throws IOException
    {
        FileInputStream fr = new FileInputStream(f);
   		return systemCall(call, fr, timeoutmillis);
    }

    public static String[] systemCall(String call, String s) throws IOException
    {
        InputStream fr = new ByteArrayInputStream(s.getBytes());
    	return systemCall(call, fr);
    }

    public static String[] systemCall(String call, InputStream stdin) throws IOException
    {
//        System.out.println("SYSTEM: "+call);
        
        Process bogoproc = Runtime.getRuntime().exec(call);
        return systemCall(bogoproc, stdin);
    }

    public static String[] systemCall(String call, InputStream stdin, long timeoutmillis) throws IOException
    {
//        System.out.println("SYSTEM: "+call);
        
        Process bogoproc = Runtime.getRuntime().exec(call);
        return systemCall(bogoproc, stdin, timeoutmillis);
    }
    
    public static String[] systemCall(String[] call, final InputStream stdin) throws IOException
    {
        Process bogoproc = Runtime.getRuntime().exec(call);
        return systemCall(bogoproc, stdin);
    }
    
    public static String[] systemCall(String[] call, final InputStream stdin, long timeoutmillis) throws IOException
    {
        Process bogoproc = Runtime.getRuntime().exec(call);
        return systemCall(bogoproc, stdin, timeoutmillis);
    }
    
    public static String[] systemCall(final Process bogoproc, final InputStream stdin) throws IOException
    {
    	return systemCall(bogoproc, stdin, -1);
    }
    
    public static String[] systemCall(final Process bogoproc, final InputStream stdin, final long timeoutmillis) throws IOException
    {
    	final long timetodie = System.currentTimeMillis() + timeoutmillis; 
    	final boolean[] ba = { false, false, false };
    	
    	Runnable r1 = new Runnable()
		{
			public void run()
			{
		        if (stdin != null)
		        {
		        	  try
		        	  {
			            OutputStream os = new BufferedOutputStream(bogoproc.getOutputStream());
			            sendData(stdin, os, -1, 4096);
			            os.flush();
			            os.close();
			            
			            stdin.close();
		        	  } catch (Exception x) { x.printStackTrace(); }
		        }
		    	
		        while (timeoutmillis == -1 || System.currentTimeMillis() < timetodie) try{
		        	bogoproc.exitValue();
		        	break;
		        } catch (Exception e){}
		        
		        ba[0] = true;
			}
		};
		new Thread(r1).start();

		final ByteArrayOutputStream err = new ByteArrayOutputStream();
        final ByteArrayOutputStream out = new ByteArrayOutputStream();

        Runnable r2 = new Runnable()
		{
			public void run()
			{
	      	  try
	      	  {
	              InputStream is = new BufferedInputStream(bogoproc.getInputStream());
	              sendData(is, out, -1, 4096);
		          out.flush();
		          out.close();
		          is.close();
	      	  } catch (Exception x) { x.printStackTrace(); }
		        
	      	  ba[1] = true;
			}
		};
		new Thread(r2).start();
      	
		Runnable r3 = new Runnable()
		{
			public void run()
			{
	          try
	          {
	        	  InputStream es = new BufferedInputStream(bogoproc.getErrorStream());
	              sendData(es, err, -1, 4096);
	              err.flush();
	  	          err.close();
	  	          es.close();
	      	  } catch (Exception x) { x.printStackTrace(); }
		        
	      	  ba[2] = true;
			}
		};
		new Thread(r3).start();

		while (! (ba[0] && ba[1] && ba[2])) try {
			Thread.sleep(100);
		}
		catch (Exception x) {}
		
        String outs = out.toString();
        String errs = err.toString();

//System.out.println(outs);
//System.out.println(errs);

        return new String[] {outs , errs };
    }
    
    public static byte[] readFile(File f) throws Exception
    {
    	FileInputStream fis = new FileInputStream(f);
    	ByteArrayOutputStream baos = new ByteArrayOutputStream();
    	sendData(fis, baos, (int)f.length(), 4096);
    	fis.close();
    	baos.flush();
    	baos.close();
    	return baos.toByteArray();
    }

	public static void writeFile(File f, byte[] ba) throws IOException
	{
		writeFile(f, ba, false);
	}
	
	public static void writeFile(File f, byte[] ba, boolean b) throws IOException 
	{
		FileOutputStream fos = new FileOutputStream(f, b);
		fos.write(ba);
		fos.flush();
		fos.close();
	}

	   public static String htmlEncode(String in) 
	    {
			String out = "";
			char[] inArray = in.toCharArray();
			int i = inArray.length;
			while (i-->0)
			{
			        if (inArray[i] < 256)
			        {
		                if (okChars[inArray[i]]) out = inArray[i]+out;
		                else out = "&#x00" + Integer.toHexString((inArray[i] >> 4) & 0xF) + Integer.toHexString(inArray[i] & 0xF) + ";" + out;
		            }
			}	
			
			return out;
	    }

		public static void zipDir(File f, OutputStream os) throws IOException
		{
			String[] dirlist=f.list();
			ZipOutputStream z=new ZipOutputStream(os);
			for(int i=0;i<dirlist.length;i++) zip(new File(f,dirlist[i]), "", z);
			z.flush();
			z.close();
		}

		public static void zip(File x, String Dir, ZipOutputStream z) throws IOException 
		{
			if(!x.exists())
				System.err.println("file not found");
			if(!x.isDirectory())
			{
				z.putNextEntry(new ZipEntry((Dir+x.getName()).replace('\\','/')));
				FileInputStream y=new FileInputStream(x);
				byte[] a=new byte[(int)x.length()];
				int did=y.read(a);
				if(did!=x.length())
				   System.err.println("DID NOT GET WHOLE FILE "+Dir+x.getName()+" ; only "+ did+ " of "+x.length());
				z.write(a,0,a.length);
				z.closeEntry();
				y.close();
				x=null;
			}
			else 
			{
				String nnn=Dir+x.getName()+File.separator;
				z.putNextEntry(new ZipEntry(nnn.replace('\\','/')));
				z.closeEntry();
				String[] dirlist=x.list();
				for(int i=0;i<dirlist.length;i++){
					zip(new File(x, dirlist[i]),nnn,z);
			   }
			}
		}

		public static void unZip(File zip, File destdir) throws IOException
		{
			destdir.mkdirs();
			
	        ZipFile z = new ZipFile( zip );
	        System.out.println( "Extracting selected files from " + zip.getCanonicalPath() + "..." );

	        Enumeration ee = z.entries();
	        while ( ee.hasMoreElements() ) {
	            ZipEntry e = (ZipEntry) ee.nextElement();
	            String ename = e.getName();
	        	System.out.println( "Extracting: " + ename );
	            ZipEntry entry = z.getEntry( ename );
	            if (entry.isDirectory())
	            {
	            	File f = new File(destdir, ename);
	            	f.mkdirs();
	            }
	            else
	            {
		            InputStream input = z.getInputStream( entry );
		            String temp = new String( ename );
		            int k = temp.lastIndexOf( "/" );
		            if ( k >= -1 )
		                temp = temp.substring( k + 1 );
		            k = temp.lastIndexOf( "\\" );
		            if ( k >= -1 )
		                temp = temp.substring( k + 1 );
		            System.out.println( "Extracting to " + temp );
		            unZipFile(input, ename, new File(destdir, ename) );
		            temp = null;
		            input.close();
	            }
	        }
	        z.close();
		}
		
		public static void unZipFile(InputStream input, String fullname, File dest) throws IOException
		{
			dest.getParentFile().mkdirs();
	        FileOutputStream output = new FileOutputStream( dest );
			byte[] buf = new byte[ 100000 ];
			int old_pacifier = -1;
			int j;
			for ( j = 0 ; ;  ) {
			int length = input.read( buf );
			if ( length <= 0 )
			break;
			j += length;
			output.write( buf, 0, length );
			int new_pacifier = ( j / 100000 ) * 100000;
			if ( new_pacifier != old_pacifier ) {
			System.out.println( "Extracting: " +
			                fullname +
			                ": " +
			                new_pacifier );
			old_pacifier = new_pacifier;
			}
			}
			output.close();
			System.out.println( "Extracting: " +
					fullname +
			       ": complete, " +
			       j + " bytes" );
		}


		public static String getFileHash(File f) throws Exception
		{
			return getFileHash(f, null);
		}
		
		public static String getFileHash(File f, Callback cb) throws Exception
		{
			MessageDigest md = MessageDigest.getInstance("MD5");

			if (cb != null)
			{
				long size = fileSize(f);
				JSONObject result = new JSONObject();
				result.put("size", size);
				cb.execute(result);
			}
			
			if (f.isDirectory()) hashFolder(f, md, cb);
			else digestFile(md, f, cb);
			
			byte[] digest = md.digest();
			String hash = toHexString(digest);

			return hash;
		}

		private static long fileSize(File f) 
		{
			if (f.isDirectory())
			{
				int total = 0;
				
				String[] list = f.list(new NoDotFilter());
				int i = list.length;
				while (i-->0) total += fileSize(new File(f, list[i]));
				
				return total;
			}
			else
			{
				return f.length();
			}
		}

		public static void hashFolder(File f, MessageDigest md) throws Exception
		{
			hashFolder(f, md, null);
		}
		
		public static void hashFolder(File f, MessageDigest md, Callback cb) throws Exception
		{
			String[] list = f.list(new NoDotFilter());
			for (int i=0; i<list.length; i++) if (!list[i].startsWith("."))
			{
				File f2 = new File(f, list[i]);
				if (f2.isDirectory()) hashFolder(f2, md, cb);
				else digestFile(md, f2, cb);
			}
		}

		public static void digestFile(MessageDigest md, File f) throws Exception
		{
			digestFile(md, f, null);
		}
		
		public static void digestFile(MessageDigest md, File f, Callback cb) throws Exception
		{
			if (f.isDirectory())
			{
				String[] list = f.list();
				int i = list.length;
				while (i-->0) digestFile(md, new File(f, list[i]), cb);
			}
			else
			{
				InputStream is = new FileInputStream(f);

				DigestInputStream dis = new DigestInputStream(is, md);

				int numRead;

			    do 
			    {
			    	byte[] buffer = new byte[1024];
			    	numRead = dis.read(buffer);
			    	if (numRead > 0) 
			    	{
			    		md.update(buffer, 0, numRead);

						if (cb != null)
						{
							JSONObject jo = new JSONObject();
//							jo.put("msg", "Digesting file "+f);
							jo.put("count", numRead);
							cb.execute(jo);
						}			
			    	}
			    } 
			    while (numRead != -1);

			    dis.close();
			}
		}
		
		protected static char randomNonHex()
		{
			return nonhexchars.charAt((int)(Math.random()*20));
		}

		private static	int lastID = 0;
	    public static String uniqueSessionID() 
		{
			if (lastID > 65535) lastID = 0;
			return ""
			    + randomNonHex()
			    + randomNonHex()
			    + randomNonHex()
			    + randomNonHex()
			    + randomNonHex()
			    + randomNonHex()
			    + Long.toHexString(System.currentTimeMillis())
			    + randomNonHex()
			    + Integer.toHexString(lastID++);

		}

	    public static File newTempFile()
	    {
	        String tempfilename = uuid();
	        File tempfile = getTempFile(tempfilename);
	        tempfile.deleteOnExit();
	        
	        return tempfile;
	    }

	    public static String uuid() 
	    {
			return UUID.randomUUID().toString();
		}

		public static File getTempFile(String tempfilename)
	    {
	        File tempfile = new File(BotBase.mMasterBot.getRootDir().getParentFile().getParentFile(),"tmp");
	        tempfile = new File(tempfile,"mime");
	        tempfile.mkdirs();
	        tempfile = new File(tempfile,tempfilename);
	        
	        return tempfile;
	    }
	    
	    public JSONArray sort(JSONArray ja, final String attr) throws Exception
	    {
	    	ArrayList<JSONObject> al = new ArrayList();
	    	for (int i = 0; i < ja.length(); i++) al.add(ja.getJSONObject(i));
	    	
	    	class JSONComparator implements Comparator<JSONObject>
	    	{
	    	    public int compare(JSONObject a, JSONObject b)
	    	    {
	    	        try { return a.getString(attr).toLowerCase().compareTo(b.getString(attr).toLowerCase()); }
	    	        catch (Exception x) { x.printStackTrace(); return -1; }
	    	    }
	    	}
	    	
	    	Collections.sort(al, new JSONComparator());
	    	return new JSONArray(al);
	    }

	    public static File getSubDir(File dir, String name, int chars, int levels)
	    {
	    	String s = name;
	    	int l = chars*levels;
	    	while (s.length()<l) s += "_";
	    	int i = 0;
	    	while (i<levels) 
	    	{
	    		int n = i++*chars;
	    		dir = new File(dir,s.substring(n, n+chars));
	    	}
	    	return dir;
	    }

		public JSONArray toJSONArray(String[] sa) 
		{
			JSONArray ja = new JSONArray();
			int n = sa.length;
			int i;
			for (i=0;i<n;i++) ja.put(sa[i]);
			return ja;
		}

	    public static String hashMD5(String in) 
	    {
	    	return new String(hashMD5Bytes(in));
	    }
	    
	    public static byte[] hashMD5Bytes(String in) 
	    {
			try
			{
				while (in.length() < 16) in += " ";
		
				MessageDigest md5 = MessageDigest.getInstance("MD5");
				md5.reset();
			
		        byte[] bytes = in.getBytes();
				md5.update(bytes);
		        return md5.digest();
			}
			catch (Exception e) { System.out.println("MD5 not implemented"); }
			
			return null;
	    }

		public static String replace(String text, String string, String string2)
		{
			return text.replace(string, string2);
		}

		public static String unMungeMIMEText(String text)
		{
			text = replace(text, "\n", "\r\n");
			text = replace(text, "\r\r\n", "\r\n");
			
			text = replace(text, "=\r\n", "");
			text = replace(text, "%", "%25");
			text = replace(text, "=", "%");
			text = hexDecode(text);
			
			return text;
		}

	    /**
	     * Return a Vector containing all data in String theStr, using String theDel as a delimitor.
	     * @return java.util.Vector
	     * @param theStr java.lang.String
	     * @param theDel java.lang.String
	     */
	    public static Vector stringToVector( String theStr, String theDel )
	    {
			Vector outV = new Vector();
			int i;
			int j = theDel.length();
			int k = 0;
	
			do
			{
		            i =  theStr.indexOf(theDel,k);
		            if (i == -1) break;
		            outV.addElement(theStr.substring(k, i));
		            k = i+j;
			} while (true);
			
			outV.addElement(theStr.substring(k));
			return outV;
	    }

	    /**
	     * Convert Vector v to a String using String theDel as a delimitor
	     * @return java.lang.String
	     * @param v java.util.Vector
	     * @param theDel java.lang.String
	     */
	    public static String vectorToString ( Vector v, String theDel )
	    {
			StringBuffer outS = new StringBuffer();
			int j = v.size();
			if (j != 0 ) 
			{
		            for (int i = 0; i < (j-1); i++)
		            {
		                outS = outS.append(v.elementAt(i));
		                outS = outS.append(theDel);
		            }
		            outS = outS.append(v.elementAt(j-1));
			}
			return outS.toString();
	    }

	    /**
	     * Replace all occurences of substring oldDel in String theText with newDel.
	     * @return java.lang.String
	     * @param theText java.lang.String
	     * @param oldDel java.lang.String
	     * @param newDel java.lang.String
	     */
	    public static String replaceString( String theText, String oldDel, String newDel)
	    {
	    	return vectorToString(stringToVector(theText, oldDel), newDel);
	    }

		public static String download(String url) throws IOException 
		{
			URL u = new URL(url);
//			InetSocketAddress isa = new InetSocketAddress(u.getHost(), u.getPort());
			URLConnection uc = u.openConnection();
			uc.setConnectTimeout(1000);
			uc.setReadTimeout(1000);
//			System.out.println(uc.getReadTimeout());
			InputStream is = (InputStream)uc.getContent();
			String id = "";
			int i = 0;
			while ((i = is.read()) != -1) id+=(char)i;
			is.close();
			return id;
		}

}
