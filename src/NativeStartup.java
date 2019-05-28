import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.net.URLConnection;
import java.util.Enumeration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import org.json.JSONObject;

import com.newbound.robot.system.JDK;

public class NativeStartup 
{
	private static final String version = "1.0";

	public NativeStartup() 
	{
	}

	public static void main(String[] args)
	{
		try
		{
			File SRC = null;
			String os = System.getProperty("os.name");
			if (os.equals("Mac OS X"))
			{
				String p = null;
				try { p = new File("x").getCanonicalFile().getParentFile().getParentFile().getParentFile().getName(); }
				catch (Exception x) { p = "DEFAULT"; }
				if (p.endsWith(".app")) p = p.substring(0, p.lastIndexOf('.'));

				File f = new File(System.getProperty("user.home"));
				f = new File(f, "Library"); 
				f = new File(f, "Application Support"); 
				f = new File(f, "Newbound"); 
				f = new File(f, p); 
				f = new File(f, "src");
				SRC = f;
			}
			else if (os.startsWith("Windows"))
			{
				String ad = System.getenv("LOCALAPPDATA");
				if (ad != null)
				{
					String p = null;
					try { p = new File("x").getCanonicalFile().getParentFile().getParentFile().getName(); }
					catch (Exception x) { p = "DEFAULT"; }
					if (p.endsWith(".app")) p = p.substring(0, p.lastIndexOf('.'));

					File f = new File(ad);
					f = new File(f, "Newbound"); 
					f = new File(f, p); 
					f = new File(f, "src");
					SRC = f;
				}
			}
			
			if (SRC == null)
			{
				String p = null;
				try { p = new File("x").getCanonicalFile().getParentFile().getName(); }
				catch (Exception x) { p = "DEFAULT"; }
				if (p.endsWith(".app")) p = p.substring(0, p.lastIndexOf('.'));

				File f = new File(System.getProperty("user.home"));
				f = new File(f, "Newbound");
				f = new File(f, p); 
				SRC = new File(f, "src");
			}

			if (rebuild(SRC))  
			{
				SRC.getParentFile().mkdirs();
				URL u = JDK.class.getClassLoader().getResource("src.zip");
				URLConnection uc = u.openConnection(); 
				int len = uc.getContentLength();
				InputStream dataIS = uc.getInputStream();
				File dest = new File(SRC.getParentFile(), "src.zip");
				FileOutputStream dataOS = new FileOutputStream(dest);
				JDK.sendData(dataIS, dataOS, len, 4096);
				dataIS.close();
				dataOS.close();
				
				unZip(dest, SRC.getParentFile());

				File lib = new File(SRC.getParentFile(), "lib");
				lib.mkdirs();
				
				String javaHome = System.getProperty("java.home");
				File home = new File(javaHome).getParentFile();
				File lib2 = new File(home, "lib");
				File javafx = new File(lib2, "ant-javafx.jar");
				JDK.copyFile(javafx, new File(lib, "ant-javafx.jar"));
				
				File f = new File(SRC.getParentFile(), "version.txt");
				writeFile(f, version.getBytes());
			}

			new File(SRC.getParentFile(), "bin").mkdirs();
			
			args = new String[] { SRC.getCanonicalPath() };
			Startup.main(args);
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	private static boolean rebuild(File SRC) throws Exception
	{
		File f = new File(SRC.getParentFile(), "version.txt");
		if (f.exists())
		{
			return ! new String(readFile(f)).equals(version);
		}
		return true;
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

    public static long sendData(InputStream dataIS, OutputStream dataOS, int length, int chunkSize) throws Exception 
    {
    	OutputStream[] osa = { dataOS };
    	return sendData(dataIS, osa, length, chunkSize);
    }

    public static long sendData(InputStream dataIS, OutputStream[] osa, int length, int chunkSize) throws Exception 
    {
    	long numbytes = 0;
    	if (length != -1) chunkSize = Math.min(length, chunkSize);
    	
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
            }
		
            if (length == -1 || numbytes < length) 
            {
            	oneChar = dataIS.read();
                if (oneChar == -1) 
                	break;
                int j = osa.length;
                while (j-->0) osa[j].write(oneChar);
                numbytes++;
            }
		
		}
		
        int j = osa.length;
        while (j-->0) osa[j].flush();
		
		return numbytes;
    }
}
