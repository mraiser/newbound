package com.newbound.util;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.net.URI;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.UUID;
import java.util.Vector;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.FileObject;
import javax.tools.ForwardingJavaFileManager;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileManager;
import javax.tools.JavaCompiler.CompilationTask;
import javax.tools.JavaFileManager.Location;
import javax.tools.JavaFileObject.Kind;

import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;

public class CompilingClassLoader extends ClassLoader
{
	private Vector<File> mRoot = null;
	private Vector<File> mJars = null;
	private File mTemp = null;
	private URLClassLoader mUCL = null;
	
	private Hashtable<File, Class> mCache = new Hashtable();

	public CompilingClassLoader(File src)
	{
		super();
		mRoot = new Vector();
		mRoot.addElement(src);
		mTemp = src;
	}
	
	public CompilingClassLoader(ClassLoader parent, Vector<File> root, File bin)
	{
		super(parent);
		mRoot = root;
		mTemp = bin;
	}

	public CompilingClassLoader(ClassLoader uc, Vector<File> root, File bin, Vector<File> jars) 
	{
		this(uc, root, bin);
		mJars = jars;
		int i = jars.size();
		URL[] urls = new URL[i];
		while (i-->0) try { urls[i] = jars.elementAt(i).toURI().toURL(); } catch (Exception x) { x.printStackTrace(); }
		mUCL = new URLClassLoader(urls, getParent());
	}
	
	public File newTempFile()
    {
        String tempfilename = UUID.randomUUID().toString();
        File tempfile = getTempFile(tempfilename);
        tempfile.deleteOnExit();
        
        return tempfile;
    }

	@Override
	protected URL findResource(String name) 
	{
		int j = mRoot.size();
		while (j-->0) try
		{
			File f = mRoot.elementAt(j);
			
			f = new File(f, name);
			if (f.exists())
			{
				System.out.println("Found resource "+f);
				return f.toURI().toURL();
			}
		}
		catch (Exception x) { x.printStackTrace(); }
		
		return null;
	}

	private byte[] getBytes( String filename ) throws IOException 
	{
		File file = new File( filename ); 
		byte raw[] = readFile(file);
		return raw;
	}
		
	public String compileClass(String name)
	{
		String out = "";
		try
		{
			File f = new File(getFilePath(name) + ".java");
			String code = new String(readFile(f));
			return compileClass(name, code);
		} 
		catch (Exception x)
		{
			out +="EXCEPTION: "+x.getMessage();
		}
		
		return out;
	}
	
	public String compileClass(String name, String code)
	{
		String out = "";
		
		try
		{
			out += compile(name, code);
		}
		catch (Exception x)
		{
			out +="EXCEPTION: "+x.getClass().getName()+" "+x.getMessage();
		}
		
		return out;
	}
	
	@Override
    public Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException 
	{
		return findClass(name);
	}
	
	@Override
	protected Class<?> findClass(String name) throws ClassNotFoundException
	{
//		System.out.println("FINDING CLASS: "+name);
		
		Class clas = null;
		
		String fileStub = getFilePath(name);
		
		String javaFilename = fileStub+".java"; 
		String classFilename = getClassPath(name)+".class";
		File javaFile = new File( javaFilename ); 
		File classFile = new File( classFilename );
		if (javaFile.exists() && (!classFile.exists() || javaFile.lastModified() > classFile.lastModified())) 
		{
			System.out.println("COMPILING CLASS: "+name);
			String s = compileClass(name);
			if (s.length() > 0 || !classFile.exists()) 
			{
				System.out.println(s);
				throw new ClassNotFoundException( "Compile failed: "+javaFilename+"\r\n"+s );
			}
		}
		else
		{
			clas = mCache.get(classFile);
			if (clas != null) return clas;
		}
		
		try 
		{
			byte raw[] = getBytes( classFilename );
			clas = defineClass( name, raw, 0, raw.length );
			mCache.put(classFile,  clas);
			System.out.println("LOADED CLASS: "+name);
			return clas;
		} 
		catch(Throwable ie ) 
		{
//			ie.printStackTrace();
		} 

		if (clas == null) 
		{ 
			clas = findLoadedClass( name );
		}
		
		if (clas == null) try
		{
			clas = mUCL.loadClass(name);
		}
		catch (Throwable x) {}		

		if (clas==null) try
		{ 
			clas = getParent().loadClass(name);
		}
		catch (Throwable x) {}

		if (clas==null) 
		{ 
			clas = findSystemClass( name ); 
		}
		
		if (clas == null) throw new ClassNotFoundException( name );

		return clas;
	}

	public String getClassPath(String name) throws ClassNotFoundException
	{
		String rest = File.separatorChar+name.replace( '.', File.separatorChar );
		try
		{
			String fileStub = mTemp.getCanonicalPath()+rest;
			return fileStub;	
		}
		catch (Exception x) { x.printStackTrace(); }
		
		throw new ClassNotFoundException(name);
	}

	public String getFilePath(String name) throws ClassNotFoundException
	{
		String rest = File.separatorChar+name.replace( '.', File.separatorChar );
		int i = mRoot.size();
		while (i-->0) try
		{
			String fileStub = mRoot.elementAt(i).getCanonicalPath()+rest;
			if (new File(fileStub+".java").exists()) return fileStub;	
		}
		catch (Exception x) { x.printStackTrace(); }
		
		return "NOSUCHFILE";
	}

	public String getTempPath(String name) throws IOException
	{
		char c = File.separatorChar;
		String fileStub = mTemp.getCanonicalPath()+c+name.replace( '.', c );
		return fileStub;	
	}

	public static byte[] readFile(File f) throws IOException
	{
		FileInputStream fis = new FileInputStream(f);
		int n = (int)f.length();
		byte[] ba = new byte[n];
		int i = 0;
		while (i<n) i+= fis.read(ba, i, n-i);
		fis.close();
		
		return ba;
	}

	public String compile(final String name, final String java) throws Exception
	{
	    JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
	    DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<JavaFileObject>();

        JavaFileObject src = new SimpleJavaFileObject(URI.create("string:///" + name.replace('.','/') + Kind.SOURCE.extension),Kind.SOURCE)
        {
        	@Override
        	public CharSequence getCharContent(boolean ignoreEncodingErrors) 
        	{
        		return java;
        	}
        };
		
        final StandardJavaFileManager sjfm = compiler.getStandardFileManager(diagnostics, null, null);
		JavaFileManager jfm = new ForwardingJavaFileManager<StandardJavaFileManager>(sjfm) 
		{
			@Override
			public JavaFileObject getJavaFileForOutput(Location location, final String className, JavaFileObject.Kind kind, FileObject sibling) throws IOException
			{
				return new SimpleJavaFileObject(URI.create("bytes:///"+className + className.replaceAll("\\.", "/") + Kind.CLASS.extension), Kind.CLASS)
	    		{
			        @Override
			        public OutputStream openOutputStream() throws IOException {
						String fileStub = getTempPath(className);
						String classFilename = fileStub+".class";
						File classFile = new File( classFilename );
						classFile.getParentFile().mkdirs();
						
						mCache.remove(classFile);
						
			            return new FileOutputStream(classFile);
			        }
	    		};
			}
		};

		Iterable<? extends JavaFileObject> compilationUnits = Arrays.asList(src);
		
		String version = System.getProperty("java.version");
		version = version.startsWith("1.8") ? "1.8" : "1.6";

		char cc = File.pathSeparatorChar;
		String path = System.getProperty("java.class.path");
		String[] list = path.split(""+cc);
		path = "";
		int i = list.length;
		while (i-->0)
		{
			File f = new File(list[i]);
			if (f.exists())
			{
				if (!path.equals("")) path = cc + path;
				path = list[i]+path;
			}
		}
		
		if (mJars != null)
		{
			Enumeration<File> e = mJars.elements();
			while (e.hasMoreElements())
			{
				File f = e.nextElement();
				path += cc+f.getCanonicalPath();
			}
		}
		
		String sourcepath = null;
		i = mRoot.size();
		while (i-->0) sourcepath = (sourcepath == null ? "" : sourcepath + cc) + mRoot.elementAt(i).getCanonicalPath();
		System.out.println(sourcepath);
		
		String[] commandLine =  {"-source", version, "-target", version, "-cp", path, "-sourcepath", sourcepath, "-Xlint:none", "-Xlint:-unchecked", "-proc:none" };
		Iterable<String> options = Arrays.asList(commandLine);
		
		CompilationTask task = compiler.getTask(null, jfm, diagnostics, options, null, compilationUnits);

		String out = "";
		boolean success = task.call();
//		out += "SUCCESS: "+success+"\n";
		if (!success) for (Diagnostic diagnostic : diagnostics.getDiagnostics()) {
			if (diagnostic.getKind().equals(javax.tools.Diagnostic.Kind.ERROR))
			{
		      out += diagnostic.getCode()+"\n";
		      out += diagnostic.getKind()+"\n";
		      out += diagnostic.getPosition()+"\n";
		      out += diagnostic.getStartPosition()+"\n";
		      out += diagnostic.getEndPosition()+"\n";
		      out += diagnostic.getSource()+"\n";
		      out += diagnostic.getMessage(null)+"\n";
			}
		}
		
//		if (mTemp.exists()) deleteDir(mTemp);
		
		return out;
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
	
    public static long sendData(InputStream dataIS, OutputStream dataOS, int length, int chunkSize) throws Exception 
    {
//    public static long sendData(InputStream dataIS, OutputStream[] osa, int length, int chunkSize, Callback cb) throws Exception 
    	long numbytes = 0;
    	if (length != -1) chunkSize = Math.min(length, chunkSize);
    	
		// Send the data in chunks of mFileChunkSize bytes
		byte[] fileBuf = new byte[chunkSize];
		int i = 0;
		
		OutputStream[] osa = { dataOS };
	
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

	public File getTempFile(String tempfilename)
    {
        File tempfile = new File(mTemp.getParentFile(),"tmp");
        tempfile.mkdirs();
        tempfile = new File(tempfile,tempfilename);
        
        return tempfile;
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

	public void addSource(File rootdir) 
	{
		if (mRoot.indexOf(rootdir) == -1) mRoot.addElement(rootdir);
	}
}
