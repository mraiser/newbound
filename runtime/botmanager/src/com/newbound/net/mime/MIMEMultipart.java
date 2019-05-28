package com.newbound.net.mime;

import java.io.*;
import java.util.*;

import com.newbound.robot.BotUtil;

public class MIMEMultipart extends BotUtil
{
    protected int mMaxMemLength = 1024 * 50;				// The most this MIMEMultipart will read into memory is 50k
    protected int mMaxLength = 1024 * 1024 * 100;			// The largest incoming data stream this MIMEMultipart will accept is 100mb
    protected int mMaxPartLength = 1024 * 1024 * 100;		// The largest sized MIME part this MIMEMultipart will accept is 100mb
    protected int mMaxLineLength = 4096;					// The longest line any part can have is 4k -- HACK: Non-text parts should not check line lengths
    
    protected int mLineIndex = 0;
    protected int mStreamIndex = 0;
    
    protected Hashtable mHeaders;
    protected Vector mData = new Vector();
    
    protected BufferedInputStream mReader = null;
    
    private File mRoot = null;
    private Counter mCounter = null;
    
    public static class Counter
    {
    	int i = 0;
    	public int next() { return i++; }
    }
    
    private MIMEMultipart(File root, Counter c) 
    { 
    	mRoot = root;
    	mRoot.mkdirs(); 
    	mCounter = c;
    }
    
    private MIMEMultipart(MIMEMultipart mm, String boundary, Counter c) throws IOException
    {
        this(mm.mRoot, c);

        mMaxLength = 1024 * 1024 * 100;			// The largest incoming data stream this MIMEMultipart will accept is 100mb
        mMaxPartLength = mm.mMaxPartLength;
        mMaxLineLength = mm.mMaxLineLength;
        mStreamIndex = mm.mStreamIndex;
        
        init(mm.mReader, boundary);
    }
    
    private MIMEMultipart(MIMEMultipart mm, BufferedInputStream reader, String boundary, Counter c) throws IOException
    {
        this(mm.mRoot, c);

        mMaxLength = 1024 * 1024 * 100;			// The largest incoming data stream this MIMEMultipart will accept is 100mb
        mMaxPartLength = mm.mMaxPartLength;
        mMaxLineLength = mm.mMaxLineLength;
        
        init(reader, boundary);
    }
    
    public MIMEMultipart(BufferedInputStream reader, String boundary, File root) throws IOException
    {
        this(root, new Counter());
        init(reader, boundary);
    }
    
    private MIMEMultipart(BufferedInputStream reader, String boundary, File root, Counter c) throws IOException
    {
        this(root, c);
        init(reader, boundary);
    }
    
    private MIMEMultipart(BufferedInputStream reader, String boundary, Hashtable ht, File root, Counter c) throws IOException
    {
        this(root, c);
        init(reader, boundary, ht);
    }
    
    private MIMEMultipart(InputStream is, String boundary, File root, Counter c) throws IOException
	{
    	this(new BufferedInputStream(is), boundary, root, c);
	}

    public MIMEMultipart(InputStream is, String b, Hashtable headers, File root) throws IOException
	{
    	this(new BufferedInputStream(is), b, headers, root, new Counter());
	}

	private void init(BufferedInputStream reader, String boundary) throws IOException
    {
        mReader = reader;
        
        Hashtable headers = MIMEHeader.parse(this);
        init(reader, boundary, headers);
    }
    
    private void init(BufferedInputStream reader, String boundary, Hashtable headers) throws IOException
    {
        mHeaders = headers;
        
        mReader = reader;

        String endB = null;
        if (boundary != null) endB = boundary+"--";

        try 
        { 
            String contentLength = (String)mHeaders.get("CONTENT-LENGTH");
            int length = Integer.parseInt(contentLength); 
            if (length != -1) mMaxLength = min(mMaxLength, mStreamIndex + length);
        }
        catch (Exception x) {}
        
        String contentType = (String)mHeaders.get("CONTENT-TYPE");
        String contentEncoding = (String)mHeaders.get("CONTENT-TRANSFER-ENCODING");
        boolean b64 = contentEncoding != null && contentEncoding.indexOf("base64") != -1;
        Base64Coder decoder = new Base64Coder();
        
        System.out.println("/// "+ contentType);
        System.out.println("//- "+ contentEncoding);
        
        if (contentType == null) contentType = "text/plain";
        if (contentType.startsWith("multipart/"))
        {
            int i = contentType.indexOf("boundary");
            i = contentType.indexOf("=", i) + 1;
            
            int j = contentType.indexOf(";", i);
            if (j == -1) j = contentType.length();
        
            String subBoundary = contentType.substring(i, j).trim();
            if (subBoundary.startsWith("\"") && subBoundary.endsWith("\""))
            {
                subBoundary = subBoundary.substring(1, subBoundary.length() - 1);
            }

            subBoundary = "--"+subBoundary;
            String subBoundaryEnd = subBoundary+"--";
            
            byte[][] holder = { null };
            readLine(holder);
            while (holder[0] != null)
            {
                if (new String(holder[0]).trim().equals(subBoundary)) break;
                readLine(holder);
            }
            
            File tempfile = new File(mRoot, ""+(mCounter.next()));
            FileOutputStream fos = new FileOutputStream(tempfile);
            
            while (true)
            {
                boolean partial = false;
                
                byte[] oneline = null;
                String s = null;
                try 
                { 
					readLine(holder);
                }
                catch (MIMELineLengthExcededException x) 
                {
                    mStreamIndex += mLineIndex;
                    mLineIndex = 0;
                    partial = true;
                }
                
				oneline = holder[0];
                s = oneline == null ? null : new String(oneline).trim();

                boolean done = ((s == null) || ((endB != null) && (s.equals(endB))) || (s.equals(subBoundaryEnd)) || (s.equals(subBoundary)));
                if (done)
                {
                    fos.close();
                    BufferedInputStream fr = new BufferedInputStream(new FileInputStream(tempfile));
 //                   BufferedReader subbuf = new BufferedReader(fr);
                    MIMEMultipart mm = new MIMEMultipart(this, fr, subBoundary, mCounter);
                    fr.close();
                    tempfile.delete();
                    mData.addElement(mm);
                    if (s != null && s.equals(subBoundary)) 
                    {
                        tempfile = new File(mRoot, ""+(mCounter.next()));
                        fos = new FileOutputStream(tempfile);
                    }
                    else break;
                }
                else 
                {
                    if (oneline != null) fos.write(oneline);
//                    fos.write(s.getBytes());
 //                   if (!partial) fos.write(("\r\n").getBytes());
                }
            }
        }
        else if (!contentType.equals("text/plain"))
        {
        	File tempfile = new File(mRoot, ""+(mCounter.next()));
        	
        	if (b64) 
        	{
            	BufferedReader br = new BufferedReader(new InputStreamReader(mReader));
            	FileOutputStream fos = new FileOutputStream(tempfile);
        		try { decoder.decodeBuffer(br, fos); }
        		catch (Exception x)
        		{
        			x.printStackTrace();
        		}
            	fos.close();
        	}
        	else 
        	{
            	BufferedInputStream br = mReader;
            	FileOutputStream fos = new FileOutputStream(tempfile);
        		try { sendData(br, fos, -1, mMaxLineLength); } catch (Exception x) { x.printStackTrace(); }
            	fos.close();
        	}
/*        	
        	int i = mReader.read();
        	int j = mMaxLength;
        	while (i != -1) 
        	{ 
        		fos.write(i); 
        		i = mReader.read(); 
        		if (--j == 0) break; 
    		}
 */ 
        	mData.addElement(tempfile);
        }
        else
        {
            byte[] oneline = null;
            File tempfile = null;
            OutputStream os;
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            os = baos;
            
            int numlines = 0;
            int cursize = 0;
            
            while (true) 
            {
                boolean partial = false;
                
                byte[][] holder = { null };

                try 
                { 
                    readLine(holder);
                }
                catch (MIMELineLengthExcededException x) 
                {
                    mStreamIndex += mLineIndex;
                    mLineIndex = 0;
                    partial = true;
                }

                oneline = holder[0];
                
                if ((oneline == null) || ((endB != null) && new String(oneline).trim().equals(endB))) break;
                
            	if (b64) 
            		oneline = decoder.decode(new String(oneline));
            		
                if ((baos != null) && (cursize + oneline.length >= mMaxMemLength)) 
                {
                    tempfile = new File(mRoot, ""+(mCounter.next()));
                    os = new FileOutputStream(tempfile);
                    baos.close();
                    os.write(baos.toByteArray());
                    baos = null;
                }

                boolean done = ((boundary != null) && (new String(oneline).trim().equals(boundary)));
                if (done)
                {
                    os.close();
                    
                    if (baos == null)
                    {
	                    mData.addElement(tempfile);
	                    tempfile = new File(mRoot, ""+(mCounter.next()));
	                    os = new FileOutputStream(tempfile);
                    }
                    else
                    {
                        mData.addElement(baos.toByteArray());
                        os = new ByteArrayOutputStream();
                    }
                    numlines = 0;
                }
                else
                {
                    os.write(oneline);
                    cursize+=oneline.length;

                    numlines++;
                }
            }
            
            os.close();
            if (numlines++ != 0) 
            {
                if (baos == null) 
                    mData.addElement(tempfile);
                else 
                    mData.addElement(baos.toByteArray());
            }
        }
    }

    /**
     * @param maxLength
     * @param i
     * @return
     */
    private int min(int a, int b)
    {
        if (a<b) return a;
        return b;
    }

    /**
     * @return
     * @throws IOException
     */
    protected void readLine(byte[][] holder) throws IOException
    {
    	holder[0] = null;
    	
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        int len = min(mMaxLineLength, mMaxLength - mStreamIndex);
        
        if (mReader == null)
        {
            System.out.println("OUCH");
        }
        
//        int chances = 0;
        while (true)
        {
//            if (mReader.available() > 0)
//            {
//                chances = 0;
                
		        int i = mReader.read();
		        if (i == -1) break;

		        baos.write(i);
		        
		        mLineIndex++;
		        
		        if (i == '\r')
		        {
		            mReader.mark(1);
		            i = mReader.read();
		            if (i != '\n') mReader.reset();
		            else 
		            {
		            	mLineIndex++;
				        baos.write(i);
		            }
		            break;
		        }
		        
		        if (i == '\n') break;
		        
		        // FIXME
		        if (false) //(mLineIndex > len) 
	            {
		        	baos.close();
		        	holder[0] = baos.toByteArray();
		            throw new MIMELineLengthExcededException("Maximum buffer length exceded reading from InputStream");
	            }
//            }
//            else
//            {
//                if (chances++ == 50) break;
//                Thread.yield();
//            }
	    }

        if (mLineIndex != 0) 
        {
	        mStreamIndex += mLineIndex;
	        mLineIndex = 0;
	        
	        baos.close();
	        
	        holder[0] = baos.toByteArray();
        }
    }

    public Hashtable getHeaders()
    {
        return mHeaders;
    }
    
    public Vector getData()
    {
        return mData;
    }
    
    public String getHeader(String key)
    {
        return (String)mHeaders.get(key.toUpperCase());
    }
}