package com.newbound.util;

import java.util.BitSet;
import java.util.stream.IntStream;

public class HashMask
{
    private short[] okChars = new short[256];
    private short sequencelength;
    private double compression;
    private short numchars;

    public HashMask(String chars, short len, double compress)
    {
        sequencelength = len;
        compression = compress;

        numchars = (short)compression;
        int n = chars.length();
        for (int i=0; i<n; i++)
            okChars[chars.charAt(i)] = (short) ((numchars++) / compression);

        short oval = numchars;
        numchars /= compression;
        if (numchars * compression < oval) numchars++;
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
        if (n<sequencelength) throw new ArrayIndexOutOfBoundsException("Query string must be "+sequencelength+" or more characters long");

        n -= (sequencelength-1);
        s = s.toLowerCase();
        for (int i=0; i<n; i++)
            set(bs, s.substring(i, i+sequencelength).getBytes());
    }

    private void set(BitSet bs, byte[] ba)
    {
        int val = 0;
        for (int i=0; i<sequencelength; i++)
        {
            char b = (char)ba[i];
            // FIXME -- ignores chars above 255
            if (b>255) b = 0;
            val += okChars[b] * (Math.pow(numchars, sequencelength-1-i));
        }
        bs.set(val);
    }

    public short getSequenceLength()
    {
        return sequencelength;
    }

    public int getNumberOfBytes()
    {
        int numbits = getNumberOfBits();
        int numbytes = (short) (numbits / 8);
        if (numbytes * 8 < numbits) numbytes++;
        return numbytes;
    }

    public int getNumberOfBits()
    {
        return (int) Math.pow(numchars, sequencelength);
    }

    public String toBinary(BitSet bs, int nbits)
    {
        final StringBuilder buffer = new StringBuilder(nbits);
        IntStream.range(0, nbits).mapToObj(i -> bs.get(i) ? '1' : '0').forEach(buffer::append);
        return buffer.toString();
    }

    public static void main(String[] args)
    {
        double compress = 6d;
        String s = "72301-6344 Armstrong Connie 774 Rowe Viaduct Dibbertside New York";
        HashMask mask = new HashMask("abcdefghijklmnopqrstuvwxyz0123456789.-_", (short)3, compress);
        BitSet bs = mask.evaluate(s);
        System.out.println(mask.toBinary(bs, mask.getNumberOfBits()));
        System.out.println(bs);
        System.out.println(bs.toByteArray().length);
        System.out.println(mask.getNumberOfBits());
        System.out.println(mask.getNumberOfBytes());
    }
}
