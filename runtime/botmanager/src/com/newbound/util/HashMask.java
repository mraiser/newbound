package com.newbound.util;

import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.BitSet;

public class HashMask
{
    private short[] okChars = new short[256];

    private short sequencelength;
    private double compression;
    private short numchars;
    private int numbits;
    private short numbytes;

    //public HashMask()
    //{
    //    this(1d);
    //}

    //public HashMask(double compress)
    //{
    //    this( (short) 3, compress);
    //}

    //public HashMask(short len, double compress)
    //{
    //    this("abcdefghijklmnopqrstuvwxyz0123456789.-_", len, compress);
    //}

    public HashMask(String chars, short len, double compress) {
        sequencelength = len;
        compression = compress;

        numchars = (short)compression;
        int n = chars.length();
        //System.out.println(n);
        for (int i=0; i<n; i++)
        {
            okChars[chars.charAt(i)] = (short) ((numchars++) / compression);
        }

        short oval = numchars;
        numchars /= compression;
        if (numchars * compression < oval) numchars++;

        numbits = (int) Math.pow(numchars, sequencelength);
        numbytes = (short) (numbits / 8);
        if (numbytes * 8 < numbits) numbytes++;

        //System.out.println("original number of characters: " + oval);
        //System.out.println("Number of characters: "+ numchars);
        //System.out.println("Number of bits: "+ numbits);
        //System.out.println("Number of bytes: "+ numbytes);
        //System.out.println("Unused bits: "+ ((numbytes * 8) - numbits));
    }

    public BitSet evaluate(File f) throws IOException
    {
        return evaluate(new BitSet(), f);
    }

    public BitSet evaluate(BitSet bs, File f) throws IOException
    {
        String lasttwochars = "";
        FileReader fr = new FileReader(f);
        while (true)
        {
            char[] cbuf = new char[1024];
            int n = fr.read(cbuf);
            if (n == -1) break;

            String s = lasttwochars + new String(cbuf, 0, n);
            int len = s.length();
            if (len>2)
            {
                evaluate(bs, s);
                lasttwochars = s.substring(len-2);
            }
            else
            {
                lasttwochars += s;
                // FIXME
                System.out.println("WARNING last two characters could be dropped. This shouldn't happen but it does.");
            }
        }
        fr.close();

        return bs;
    }

    public BitSet evaluate(String s)
    {
        return evaluate(new BitSet(), s);
    }

    public BitSet evaluate(BitSet bs, String s)
    {
        String[] sa = s.split(" ");
        int i = sa.length;
        while (i-->0)
            if (sa[i].length()>=sequencelength)
                set(bs, sa[i]);
        return bs;
    }

    public void set(BitSet bs, String s)
    {
        int n = s.length();
        // FIXME - use sequencelength
        if (n<3) throw new ArrayIndexOutOfBoundsException("Query string must be 3 or more characters long");
        n -= 2;
        s = s.toLowerCase();
        for (int i=0; i<n; i++)
            set(bs, s.charAt(i), s.charAt(i+1), s.charAt(i+2));
    }

    private void set(BitSet bs, char a, char b, char c)
    {
        // FIXME -- ignores chars above 255
        if (a>255) a = 0;
        if (b>255) b = 0;
        if (c>255) c = 0;

        int val = (okChars[a] * numchars * numchars) + (okChars[b] * numchars) + (okChars[c]);
        //System.out.println(val);
        bs.set(val);
    }

    public static void main(String[] args)
    {

        String s = "abracadabra abracadabra aaa";
        BitSet bs = new HashMask("abcdefghijklmnopqrstuvwxyz0123456789.-_", (short)3, 1d).evaluate(s);
        System.out.println(bs);
        System.out.println(bs.toByteArray().length);
    }
}
