package com.newbound.util;

import com.newbound.net.mime.MIMEHeader;
import com.newbound.robot.BotUtil;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FilenameFilter;
import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.FileVisitor;
import java.nio.file.Files;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.BitSet;
import java.util.Date;
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

    public boolean index(boolean rebuild) throws Exception
    {
        if (rebuild) BotUtil.deleteDir(workdir);
        return index(dir);
    }

    public boolean index(File f) throws Exception
    {
        File f2 = getWorkFile(f);
        return index(f, f2, new BitSet());
    }

    // FIXME - Handle workdir inside of search dir (don't index/search)
    // FIXME - Handle deleted files (detect, delete workfile)
    private File getWorkFile(File f) throws IOException
    {
        String s1 = f.getCanonicalPath();
        String s2 = dir.getCanonicalPath();
        if (!s1.startsWith(s2)) throw new IllegalArgumentException("File "+s1+" is not inside the indexed directory "+s2);

        return new File(workdir, s1.substring(s2.length()));
    }

    private boolean index(File f, File w, BitSet bs2) throws Exception
    {
        if (Files.isSymbolicLink(f.toPath())) return false;

        File dw = new File(w, DIRNAME);
        boolean isdir = f.isDirectory();
        boolean exists = w.exists();
        boolean changed = exists ? (isdir ? dw.lastModified() : w.lastModified())<f.lastModified() : true;
        if (!isdir && exists && !changed)
        {
            bs2.or(BitSet.valueOf(BotUtil.readFile(w)));
            return false;
        }
//        else if (isdir && changed)
//            System.out.println(new Date(f.lastModified())+" / "+new Date(w.lastModified())+" / "+f.getCanonicalPath());

        String name = f.getName();
        FileHashMask mask = new FileHashMask(okChars, sequencelength, compression);
        BitSet bs3 = mask.evaluate(name);

        File parent = w.getParentFile();
        parent.mkdirs();

        if (isdir)
        {
            //System.out.println("indexing folder "+f.getCanonicalPath()+" as "+w.getCanonicalPath());
            w.mkdirs();
            String[] list = f.list(filter);
            int i = list.length;
            while (i-->0) changed = index(new File(f, list[i]), new File(w, list[i]), bs3) || changed;

            if (changed)
            {
                BotUtil.writeFile(dw, bs3.toByteArray());
            }
        }
        else
        {
            String type = MIMEHeader.lookupMimeType(f.getName());
            if (INDEXCONTENT && f.length()<MAXFILESIZE && (type == null || (!type.startsWith("audio") && !type.startsWith("video") && !type.startsWith("image") && !type.startsWith("application"))))
            {
                try
                {
                    mask.evaluate(bs3, f);
                    BotUtil.writeFile(w, bs3.toByteArray());
                    changed = true;
                }
                catch (FileNotFoundException x)
                {
                    // IGNORE - Sometimes temp files disappear between list and scan
                }
            }
            else changed = false;
        }

//        if (changed)
//            System.out.println("Changed: "+f.getCanonicalPath());

        bs2.or(bs3);
        return changed;
    }

    public void search(String query, FileVisitor v, boolean searchcontent, boolean reindex) throws Exception
    {
        if (reindex) index(dir);
        search (dir, workdir, query, new FileHashMask(okChars, sequencelength, compression).evaluate(query), v, searchcontent);
    }

    public void search(File subdir, String query, FileVisitor v, boolean searchcontent, boolean reindex) throws Exception
    {
        if (reindex) index(subdir);
        search (subdir, getWorkFile(subdir), query, new FileHashMask(okChars, sequencelength, compression).evaluate(query), v, searchcontent);
    }

    private void search(File f, File w, String query, BitSet bs, FileVisitor v, boolean searchcontent) throws Exception
    {
        // Check name for match
        boolean isdir = f.isDirectory();
        String fname = f.getName().toLowerCase();
        String[] sa = query.toLowerCase().split(" ");
        int n = sa.length;
        int m = 0;
        for (int i=0; i<n; i++) if (fname.contains(sa[i])) m++;
        if (n == m)
        {
            v.visitFile(f, null);
            if (!isdir) return;
        }

        // Check index in workdir
        File dw = new File(w, DIRNAME);
        if ((isdir && dw.exists()) || (searchcontent && w.exists()))
        {
            BitSet bs1 = (BitSet) bs.clone();
            byte[] ba = BotUtil.readFile(isdir ? dw : w);
            BitSet bs2 = BitSet.valueOf(ba);
            bs1.and(bs2);
            if (bs.equals(bs1))
            {
                if (isdir)
                {
                    String[] list = f.list(filter);
                    n = list.length;
                    for (int i = 0; i < n; i++)
                        search(new File(f, list[i]), new File(w, list[i]), query, bs, v, searchcontent);
                }
                else
                {
                    Scanner scanner = new Scanner(f);
                    Hashtable<String, Boolean> hits = new Hashtable();
                    for (int i = 0; i < n; i++) hits.put(sa[i], false);
                    n = hits.size();
                    m = 0;
                    while (scanner.hasNextLine())
                    {
                        // FIXME - How long is a line?
                        String line = scanner.nextLine();
                        for (int i = 0; i < n; i++)
                        {
                            if (line.contains(sa[i]))
                            {
                                boolean b = hits.get(sa[i]);
                                if (!b)
                                {
                                    hits.put(sa[i], true);
                                    m++;
                                    if (m == n) break;
                                }
                            }
                        }

                        if (m == n)
                        {
                            v.visitFile(f, null);
                            break;
                        }
                    }
                    //if (m != n) System.out.println("False positive: "+f);
                    scanner.close();
                }
            }
        }
    }

    public static void main(String[] args) throws Exception
    {
        boolean indexcontent = true;
        boolean searchcontent = true;
        String charset = "abcdefghijklmnopqrstuvwxyz0123456789.-_";
        int maxfilelength = 5 * 1024 * 1024;

        if (args.length<2)
        {
            System.out.println("USAGE: java com.newbound.util.DirectoryIndex /path/to/sourcedir /path/to/workdir");
            System.exit(0);
        }

        String src = args[0];
        String wrk = args[1];

        DirectoryIndex di = new DirectoryIndex(
                new File(src),
                new File(wrk),
                new NoDotFilter(),
                charset,
                (short)3,
                1,
                indexcontent,
                maxfilelength);

        di.index(false);

        FileVisitor v = new SimpleFileVisitor()
        {
            @Override
            public FileVisitResult visitFile(Object o, BasicFileAttributes basicFileAttributes) throws IOException
            {
                System.out.println(((File)o).getCanonicalPath());
                return null;
            }
        };
        di.search("camera_frame_v5_top", v, searchcontent, false);
    }
}
