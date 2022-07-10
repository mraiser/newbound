

import java.io.File;
import java.lang.reflect.Method;
import java.util.Vector;

import com.newbound.util.CompilingClassLoader;
import com.newbound.util.Installer;

public class Startup 
{
	private static Startup SINGLETON = null;
	private Runtime mRuntime = null;
	class Runtime
	{
		File SRC;
		File ROOT;
		File BIN;
		Vector<File> V;
		Vector<File> JARS;
		Object RUSTENV = null;
		Method RUSTEXECUTE = null;

		Runtime(File src, File root, File bin, Vector<File> v, Vector<File> jars)
		{
			SRC = src;
			ROOT = root;
			BIN = bin;
			V = v;
			JARS = jars;
		}

		public CompilingClassLoader newClassLoader()
		{
			return new CompilingClassLoader(CompilingClassLoader.class.getClassLoader(), V, BIN, JARS);
		}
	}

    private Startup()
    {
    	super();
	}

	public Runtime init(File SRC) throws Exception
	{
//		System.out.println("Source directory: "+SRC);

		File ROOT = new File(SRC.getParentFile(), "runtime");
//		System.out.println("Working directory: "+ROOT);

		// FIXME - Repo includes runtime so this is never run, except maybe if you build a standalone installer, in which case it might not even work.
		File rb = new File(SRC.getParentFile(), "rebuild");
		boolean build = !ROOT.exists() || rb.exists();
		if (build)
		{
			System.out.println("First run... building runtime directory...");
			Installer.install(ROOT.getParentFile());
			rb.delete();
		}
//		else
//		{
//			System.out.println("Directory runtime exists, skipping build.");
//		}

		String[] bots = ROOT.list();

		Vector<File> v = new Vector();
		Vector<String> v2 = new Vector();
		int i = bots.length;
		while (i-->0)
		{
			String bot = bots[i];
			File home = new File(ROOT, bot);

			File f = new File(home, "src");
			if (f.exists() && f.isDirectory())
			{
//					File f1 = new File(home, "app.properties");
				File f2 = new File(ROOT, bot);
				File f3 = new File(f2, "src");
				v.addElement(f3);
			}
		}
		v.addElement(SRC);

		File code = new File(ROOT.getParentFile(), "generated");
//			code = new File(code, "code");
		v.addElement(code);

		Vector<File> jars = new Vector();
		File lib = new File(SRC.getParentFile(), "lib");
		lib.mkdirs();
		String[] libs = lib.list();
		int j = libs.length;
		while (j-->0) jars.addElement(new File(lib, libs[j]));

		File bin = new File(SRC.getParentFile(), "bin");
//			deleteDir(bin);

		mRuntime = new Runtime(SRC, ROOT, bin, v, jars);
		return mRuntime;
	}

	public static void main(String[] args)
	{
		try
		{
			File SRC = args.length > 0 ? new File(args[0]) : new File("x").getCanonicalFile().getParentFile();
//			if (SRC.getName().equals("temp")) SRC = SRC.getParentFile();
			if (!SRC.getName().equals("src") && new File(SRC, "src").exists()) SRC = new File(SRC, "src");
			SINGLETON = new Startup();
			Runtime runtime = SINGLETON.init(SRC);

			while (true) try
			{
				System.gc();
				CompilingClassLoader me = runtime.newClassLoader();
				Class c = me.loadClass("com.newbound.robot.BotManager");
				Method m = c.getMethod("start", Boolean.class, File.class);
				Object o = c.newInstance();
				File f = new File(runtime.ROOT, "botmanager");
				m.invoke(o, true, f);
				File restart = new File(f, "restart");
				if (restart.exists()) restart.delete();
				else break;
			}
			catch (Exception x) { x.printStackTrace(); }
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	public static void initFromRust(String root) throws Exception
	{
		File SRC = new File(root);
		if (!SRC.getName().equals("src") && new File(SRC, "src").exists()) SRC = new File(SRC, "src");
		SINGLETON = new Startup();
		Runtime runtime = SINGLETON.init(SRC);
		CompilingClassLoader me = runtime.newClassLoader();
		Class c = me.loadClass("com.newbound.code.RustEnv");
		Method m = c.getMethod("init", String.class);
		Object o = c.newInstance();
		File f = new File(runtime.ROOT, "botmanager");
		m.invoke(o, f.getCanonicalPath());

		m = c.getMethod("execute", String.class, String.class, String.class);
		runtime.RUSTENV = o;
		runtime.RUSTEXECUTE = m;
	}

	public static String executeFromRust(String lib, String id, String args) throws Exception
	{
		return (String)SINGLETON.mRuntime.RUSTEXECUTE.invoke(SINGLETON.mRuntime.RUSTENV, lib, id, args);
	}
}
