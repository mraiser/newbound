package com.newbound.util;

import com.newbound.net.service.http.HTTPService;
import com.newbound.robot.BotUtil;

import java.io.File;
import java.io.FilenameFilter;
import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.FileVisitor;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.BitSet;
import java.util.Hashtable;
import java.util.Scanner;

public class DirectoryIndex
{
    private static final String DIRNAME = "8cee109e-8684-43a1-ada5-eca55e4ba55d";

    private File dir;
    private File workdir;
    private short sequencelength;
    private double compression;
    private String okChars;
    private FilenameFilter filter;

    private boolean INDEXCONTENT;
    private int MAXFILESIZE;

    public DirectoryIndex(File directory, File workdirectory, FilenameFilter filenamefilter, String chars, short len, double compress, boolean indexcontent, int maxfilelength)
    {
        dir = directory;
        workdir = new File(workdirectory, "x"+directory.hashCode());
        workdir.mkdirs();
        sequencelength = len;
        compression = compress;
        okChars = chars;
        filter = filenamefilter;
        INDEXCONTENT = indexcontent;
        MAXFILESIZE = maxfilelength == -1 ? Integer.MAX_VALUE : maxfilelength;
    }

    public void index() throws IOException
    {
        BotUtil.deleteDir(workdir);
        index(dir);
    }

    public void index(File f) throws IOException
    {
        File f2 = getWorkFile(f);
        index(f, f2);
    }

    private File getWorkFile(File f) throws IOException
    {
        String s1 = f.getCanonicalPath();
        String s2 = dir.getCanonicalPath();
        if (!s1.startsWith(s2)) throw new IllegalArgumentException("File "+s1+" is not inside the indexed directory "+s2);

        return new File(workdir, s1.substring(s2.length()));
    }

    private BitSet index(File f, File w) throws IOException
    {
        String name = f.getName();
        HashMask mask = new HashMask(okChars, sequencelength, compression);
        BitSet bs = mask.evaluate(name);

        File parent = w.getParentFile();
        parent.mkdirs();

        if (f.isDirectory())
        {
            //System.out.println("indexing folder "+f.getCanonicalPath()+" as "+w.getCanonicalPath());
            w.mkdirs();
            String[] list = f.list(filter);
            int i = list.length;
            while (i-->0) bs.or(index(new File(f, list[i]), new File(w, list[i])));
            w = new File(w, DIRNAME);
            BotUtil.writeFile(w, bs.toByteArray());
        }
        else
        {
            String type = HTTPService.getMIMEType(f.getName());
            if (INDEXCONTENT && f.length()<MAXFILESIZE && (type == null || (!type.startsWith("audio") && !type.startsWith("video") && !type.startsWith("image") && !type.startsWith("application"))))
            {
                try
                {
                    //System.out.println("indexing file " + f + " of type " + type);
                    mask.evaluate(bs, f);
                    BotUtil.writeFile(w, bs.toByteArray());
                }
                catch (Exception x)
                {
                    // FIXME - should we do something here? Sometimes temp files disappear between list and scan (FileNotFoundException)
                    x.printStackTrace();
                }
            }
            //else
            //    System.out.println("Skipping file " + f + " of type "+type);
        }

        return bs;
    }

    public void search(String query, FileVisitor v, boolean searchcontent) throws Exception
    {
        search (dir, workdir, query, new HashMask(okChars, sequencelength, compression).evaluate(query), v, searchcontent);
    }

    private void search(File f, File w, String query, BitSet bs, FileVisitor v, boolean searchcontent) throws Exception
    {
        boolean isdir = f.isDirectory();
        BitSet bs1 = (BitSet) bs.clone();
        byte[] ba = isdir ? BotUtil.readFile(new File(w, DIRNAME))
                : w.exists() && searchcontent ? BotUtil.readFile(w)
                : new HashMask(okChars, sequencelength, compression).evaluate(f.getName()).toByteArray();

        BitSet bs2 = BitSet.valueOf(ba);
        bs1.and(bs2);
        if (bs.equals(bs1))
        {
            if (isdir)
            {
                // FIXME - Should probably do literal scan not hashmask
                bs2 = new HashMask(okChars, sequencelength, compression).evaluate(f.getName());
                bs1.and(bs2);
                if (bs.equals(bs1))
                    v.visitFile(f, null);

                String[] list = f.list(filter);
                int n = list.length;
                for (int i=0; i<n; i++)
                {
                    search(new File(f, list[i]), new File(w, list[i]), query, bs, v, searchcontent);
                }
            }
            else
            {
                if (!searchcontent || !w.exists())
                    // FIXME - Should probably do literal scan not hashmask
                    v.visitFile(f, null);
                else
                {
                    // FIXME - Should probably do literal scan not hashmask
                    bs2 = new HashMask(okChars, sequencelength, compression).evaluate(f.getName());
                    bs1.and(bs2);
                    if (bs.equals(bs1))
                        v.visitFile(f, null);
                    else
                    {
                        Scanner scanner = new Scanner(f);
                        String[] sa = query.split(" ");
                        int n = sa.length;
                        int count = 0;
                        Hashtable<String, Boolean> hits = new Hashtable();
                        for (int i = 0; i < n; i++) hits.put(sa[i], false);
                        while (scanner.hasNextLine()) {
                            // FIXME - How long is a line?
                            String line = scanner.nextLine();
                            for (int i = 0; i < n; i++) {
                                if (line.contains(sa[i])) {
                                    boolean b = hits.get(sa[i]);
                                    if (!b) {
                                        hits.put(sa[i], true);
                                        count++;
                                        // FIXME - same word twice in query string will never succeed.
                                        if (count == sa.length) {
                                            v.visitFile(f, null);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        scanner.close();
                    }
                }
            }
        }
    }

    public static void main(String[] args) throws Exception
    {
        boolean indexcontent = true;
        boolean searchcontent = true;

        DirectoryIndex di = new DirectoryIndex(
                new File("/home/mraiser/"),
                new File("/var/lib/newbound/directoryindex"),
                new NoDotFilter(),
                "abcdefghijklmnopqrstuvwxyz0123456789.-_",
                (short)3,
                1,
                indexcontent,
                50 * 1024 * 1024);

        //di.index();

        FileVisitor v = new SimpleFileVisitor()
        {
            @Override
            public FileVisitResult visitFile(Object o, BasicFileAttributes basicFileAttributes) throws IOException
            {
                System.out.println(((File)o).getCanonicalPath());
                return null;
            }
        };
        di.search("cameraHoles", v, searchcontent);
    }
}
