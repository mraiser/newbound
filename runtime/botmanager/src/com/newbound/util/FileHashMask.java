package com.newbound.util;

import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.BitSet;

public class FileHashMask extends HashMask
{
    public FileHashMask(String chars, short len, double compress)
    {
        super(chars, len, compress);
    }

    public BitSet evaluate(File f) throws IOException
    {
        return evaluate(new BitSet(), f);
    }

    public BitSet evaluate(BitSet bs, File f) throws IOException
    {
        String remainder = "";
        FileReader fr = new FileReader(f);
        while (true)
        {
            char[] cbuf = new char[1024];
            int n = fr.read(cbuf);
            if (n == -1) break;

            String s = remainder + new String(cbuf, 0, n);
            int len = s.length();
            short sequencelength = getSequenceLength();
            if (len>=sequencelength)
            {
                evaluate(bs, s);
                remainder = s.substring(len-(sequencelength-1));
            }
            else
            {
                remainder += s;
                // FIXME
                System.out.println("WARNING last "+sequencelength+" characters could be dropped. This shouldn't happen but it does.");
            }
        }
        fr.close();

        return bs;
    }

}
