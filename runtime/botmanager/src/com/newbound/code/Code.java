package com.newbound.code;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.lang.reflect.Method;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.Vector;

import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.code.primitive.Primitive;
import com.newbound.code.primitive.math.Divide;
import com.newbound.code.primitive.math.Equals;
import com.newbound.code.primitive.math.Int;
import com.newbound.code.primitive.math.Minus;
import com.newbound.code.primitive.math.Mod;
import com.newbound.code.primitive.math.Multiply;
import com.newbound.code.primitive.math.Plus;
import com.newbound.code.primitive.object.Get;
import com.newbound.code.primitive.object.Insert;
import com.newbound.code.primitive.object.Put;
import com.newbound.code.primitive.object.Remove;
import com.newbound.robot.BotBase;
import com.newbound.robot.BotUtil;
import com.newbound.robot.JSONTransform;
//import com.newbound.robot.Primitive;
import com.newbound.robot.PeerBot;
import com.newbound.robot.SYS;

public class Code 
{
	private static final boolean DEBUG = false;
	private static File ROOT = null;
	public static JSONObject PRIMS = new JSONObject();
	public static String PYTHON = "python3"; //"/Library/Frameworks/Python.framework/Versions/3.6/bin/python3";
	
	public JSONObject CODE;
	public String LIB;

	static
	{
		try {
			// MATH
			PRIMS.put("+", new Plus());
			PRIMS.put("-", new Minus());
			PRIMS.put("*", new Multiply());
			PRIMS.put("/", new Divide());
			PRIMS.put("%", new Mod());
			PRIMS.put("int", new Int());
			PRIMS.put("equals", new Equals());

			// OBJECT
			PRIMS.put("Get", new Get());
			PRIMS.put("Put", new Put());
			PRIMS.put("Remove", new Remove());

			//ARRAY
			PRIMS.put("insert", new Insert());
		}
		catch (Exception x) { x.printStackTrace(); }
	}
	
	class RO
	{
		long timestamp;
		File file;
		JSONTransform trans;
		
		public RO(long t, File f, JSONTransform c)
		{
			timestamp = t;
			file = f;
			trans = c;
		}
	}
	
	private static final Hashtable<String,RO> EXT = new Hashtable();
	
	public Code(JSONObject code, String lib) 
	{
		CODE = code;
		LIB = lib;
	}

	public JSONObject execute(JSONObject args) throws Exception
	{
			if (DEBUG) System.out.println("Evaluating code: "+CODE);

			//String type = !CODE.has("type") ? "flow" : CODE.getString("type");
			String type = CODE.has("type") ? CODE.getString("type") : CODE.has("lang") ? CODE.getString("lang") :CODE.has("java") ?"java" : CODE.has("python") ? "python" : "flow";

			if (type.equals("java"))
			{
				JSONTransform jt = precompile();
			    return jt.execute(args);
			}
			
			if (type.equals("js"))
			{
				String js = CODE.getString("script");
				return SYS.evalJS(js);
			}
			
			if (type.equals("python"))
			{
				String py = CODE.getString("id");
				String pyid = CODE.has("python") ? CODE.getString("python") : CODE.getString("cmd");
				JSONObject cmd = BotBase.getBot("botmanager").getData(LIB, pyid).getJSONObject("data");
				return evalCommandLine(PYTHON, cmd, args, new File(getRoot(py), py+".py"));
			}
			
			int i;
			boolean done = false;
			
			JSONObject out = new JSONObject();
			CODE.put("out", out);
			
			JSONArray cmds = CODE.getJSONArray("cmds");
			JSONArray cons = CODE.getJSONArray("cons");
			
			int n = cons.length();
			int n2 = cmds.length();
			
			for (i=0;i<n2;i++) 
			{
				JSONObject cmd = cmds.getJSONObject(i);
				if (DEBUG) System.out.println("pre-processing cmd "+i+": "+cmd);
				if (!cmd.has("done") || !cmd.getBoolean("done"))
				{
					JSONObject in = cmd.getJSONObject("in");
					Iterator<String> it = in.keys();
					if (DEBUG) System.out.println(it.hasNext() ? "Analyzing inputs" : "No inputs, evaluating cmd");
					if (!it.hasNext()) evaluate(cmd);
					else 
					{
						boolean b = true;
						
						while (it.hasNext())
						{
							String key = it.next();
							in.getJSONObject(key).put("done", false);
							JSONObject con = lookupConnection(i, key, "in");
							if (con == null) 
								in.getJSONObject(key).put("done", true);
							else b = false; //b && (in.has("done") && in.getBoolean("done"));
						}
						
						if (DEBUG) System.out.println(b ? "No connections to any inputs, evaluating cmd" : "Command requires input to evaluate");
						if (b) evaluate(cmd);
					}
				}
			}
			
			while (!done)
			{
				if (DEBUG) System.out.println("Evaluating connections...");
				boolean c = true;
				
				for (i=0;i<n;i++)
				{
					JSONObject con = cons.getJSONObject(i);
					if (DEBUG) System.out.println("Evaluating connection "+i+": "+con);
					if (!con.has("done") || !con.getBoolean("done"))
					{
						c = false;
						JSONArray ja = con.getJSONArray("src");
						int src = ja.getInt(0);
						String srcname = ja.getString(1);
						ja = con.getJSONArray("dest");
						int dest = ja.getInt(0);
						String destname = ja.getString(1);
									
						boolean b = false;
						Object val = null;
						if (src == -1) 
						{
							val = args.has(srcname) ? args.get(srcname) : null;
							b = true;
							if (DEBUG) System.out.println("Value from input bar node "+srcname+" is "+val);
						}
						else
						{
							JSONObject cmd = cmds.getJSONObject(src);
							if (cmd.has("done") && cmd.getBoolean("done"))
							{
								JSONObject vals = cmd.getJSONObject("out");
								val = vals.has(srcname) ? vals.get(srcname) : null;
								b = true;
								if (DEBUG) System.out.println("Value from command "+src+" output node "+srcname+" is "+val);
							}
							else if (DEBUG) System.out.println("Value from command "+src+" output node "+srcname+" is not ready yet");
						}
						
						if (b)
						{
							if (DEBUG) System.out.println("Connection "+i+" is done");
							con.put("done",  true);
							if (dest == -2)
							{
								if (val != null) out.put(destname, val);
								if (DEBUG) System.out.println("Value "+val+" passed to output node "+destname);
							}
							else
							{
								JSONObject cmd = cmds.getJSONObject(dest);
								if (cmd.getString("type").equals("undefined")) 
								{
									cmd.put("done", true);
									if (DEBUG) System.out.println("Marking undefined command as done");
								}
								else
								{
									JSONObject ins = cmd.getJSONObject("in");
									JSONObject var = ins.getJSONObject(destname);
									if (val != null) var.put("val", val);
									var.put("done",  true);
									
									Iterator it = ins.keys();
									while (it.hasNext() && b)
									{
										JSONObject in = ins.getJSONObject((String)it.next());
										b = b && in.has("done") && in.getBoolean("done");
									}
									
									if (DEBUG) System.out.println(b ? "All inputs to dest cmd done, evaluating" : "Not all inputs to cmd done yet");
									if (b)
										evaluate(cmd);
								}
							}		
						}
					}
					else if (DEBUG) System.out.println("Connection "+i+" is done");

				}

				if (DEBUG) System.out.println(c ? "All connections had already fired. We must be done" : "One or more connections fired. Check all the commands");

				if (c) done = true;
/*
				else
				{
					boolean b = true;
					for (i=0;i<n2;i++)
					{
						JSONObject cmd = cmds.getJSONObject(i);
						if (!cmd.has("done") || !cmd.getBoolean("done")) { b = false; break; }
					}
					done = b;
					if (DEBUG) System.out.println(done ? "Done!" : "Not done yet, keep trying!");
				}
*/			
			}
			return out;
	}
	
	public JSONTransform precompile() throws Exception 
	{
		try
		{
			JSONTransform jt = null;
			String oid = CODE.getString("id");
	
			RO ro = EXT.get(oid);
			if (ro != null && ro.timestamp == ro.file.lastModified()) return ro.trans;
			
			File root = getRoot(oid);
			File src = new File(root, oid+".java");
	
			String id = BotUtil.uniqueSessionID();
			File tmp = new File(root, id+".java");
			try
			{
				String nucode = new String(BotUtil.readFile(src)).replaceAll(oid, id);
				BotUtil.writeFile(tmp, nucode.getBytes());
				
			    String claz = "com.newbound.robot.published."+LIB+"."+id;
			    Class c = SYS.loadClass(getRootDir(), claz, false);
			  
			    if (DEBUG) System.out.println("LOADING JSONTransform "+claz);
			    Object o = c.newInstance();
			    jt = (JSONTransform)o;
			}
			finally
			{
				tmp.delete();
			}
		    
		    EXT.put(oid, new RO(src.lastModified(), src, jt));
	
		    return jt;
		}
		catch (Exception x)
		{
			String claz = "com.newbound.robot.published."+LIB+"."+CODE.getString("id");
			Class c = SYS.loadClass(getRootDir(), claz, false);
			if (DEBUG) System.out.println("LOADING JSONTransform "+claz);
			Object o = c.newInstance();
			return (JSONTransform)o;
		}
	}

	private File getRoot(String oid) 
	{
		File root = new File(getRootDir(), "com");
		root = new File(root, "newbound");
		root = new File(root, "robot");
		root = new File(root, "published");
		root = new File(root, LIB);
//		root = new File(root, "code");
		return root;
	}

	private static File getRootDir()
	{
		if (ROOT == null) ROOT = new File(BotBase.getBot("botmanager").getRootDir().getParentFile().getParentFile(), "generated");
		return ROOT;
	}


	private JSONObject lookupConnection(int cmd, String name, String which) throws Exception
	{
		JSONArray cons = CODE.getJSONArray("cons");
		int i = cons.length();
		while (i-->0)
		{
			JSONObject con = cons.getJSONObject(i);
			JSONArray bar = con.getJSONArray(which.equals("in") ? "dest" : "src");
			if (bar.getString(1).equals(name)) return con;
		}
		return null;
	}

	private void evaluate(JSONObject cmd) throws Exception
	{
		JSONObject in = new JSONObject();
		JSONObject in2 = cmd.getJSONObject("in");
		Iterator keys = in2.keys();
		while (keys.hasNext())
		{
			String name = (String)keys.next();
			JSONObject in3 = in2.getJSONObject(name);
			if (in3.has("val")) in.put(name, in3.get("val"));
			if (DEBUG) System.out.println(in3.has("val") ? "HAS "+name : "MISSING: "+name+"("+in3+")");
		}
		if (DEBUG) System.out.println("in: "+in);
		if (DEBUG) System.out.println("in2: "+in2);

		JSONObject out;
		
		String type = cmd.getString("type");
		if (type.equals("primitive")) out = ((Primitive)PRIMS.get(cmd.getString("name"))).execute(in); 
		else if (type.equals("code"))
		{
			JSONObject code = cmd.getJSONObject("code");
			Code c = new Code(code, LIB);
			out = c.execute(in);
		}
		else if (type.equals("peer"))
		{
			PeerBot pb = PeerBot.getPeerBot();
			String bot = cmd.getString("btype");
			String name = cmd.getString("name");
			JSONObject jo = in; //cmd.getJSONObject("args");
			Hashtable params = new Hashtable();
			Iterator<String> list = jo.keys();
			while (list.hasNext())
			{
				String k = list.next();
				params.put(k, jo.get(k));
			}
			
			if (false) //(cmd.has("uuid"))
			{
				String id = cmd.getString("uuid");
				out = pb.sendCommand(id, bot, name, params);
			}
			else 
			{
				out = new JSONObject();
				out.put("result", pb.sendCommand(bot, name, params));
			}
		}
		else if (type.equals("constant"))
		{
			out = cmd.getJSONObject("out");
			Iterator<String> i = out.keys();
			while (i.hasNext()) 
			{
				String key = i.next();
				Object val = cmd.get("name");
				String ctype = cmd.getString("ctype");
				if (ctype.equals("int")) val = Integer.parseInt(""+val);
				else if (ctype.equals("decimal")) val = Double.parseDouble(""+val);
				else if (ctype.equals("boolean")) val = Boolean.parseBoolean(""+val);
				else if (ctype.equals("object")) val = new JSONObject(""+val);
				else if (ctype.equals("array")) val = new JSONArray(""+val);
				out.put(key, val);
			}
		}
		else out = new JSONObject();
		
		cmd.put("out", out);
		cmd.put("done",  true);
	}

	public static void main(String[] args) 
	{
		try {
			String s = "{ cons: [ { src:[-1,'a'], dest:[0,'a'] },{ src:['-1','b'], dest:[0,'b'] },{ src:[1,'a'], dest:[3,'a'] },{ src:[0,'c'], dest:[2,'a'] },{ src:[2,'b'], dest:[3,'b'] },{ src:[3,'c'], dest:[-2,'a'] }], cmds: [ { name:'+', in: { a: {}, b: {} }, type:'primitive', },{ name:'3', in: {}, type:'constant', out:{a:3}, done:true },{ name:'int', in: { a: {} }, type:'primitive', },{ name:'equals', in: { a: {}, b: {} }, type:'primitive', }] }";
			JSONObject jo = new JSONObject(s);
			JSONObject in = new JSONObject("{a:-2,b:4}");
			System.out.println(new Code(jo, "runtime").execute(in));
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	// FIXME - Move to SYS
	public JSONObject evalCommandLine(String app, JSONObject cmd, JSONObject args, File py) throws Exception 
	{
		JSONArray params = cmd.getJSONArray("params");
		int i = params.length();
		String[] call = new String[i+2];
		call[0] = app;
		call[1] = py.getCanonicalPath();
		while (i-->0) 
		{
			String s = params.getJSONObject(i).getString("name");
			s = ""+args.get(s);
			call[i+2] = s;
		}
		
		Process p = Runtime.getRuntime().exec(call);
		p.waitFor();
		i = p.exitValue();
		
		if (i == 0)
		{
			ByteArrayOutputStream baos = new ByteArrayOutputStream();
			BotUtil.sendData(p.getInputStream(), baos, -1, 4096);
			BotUtil.sendData(p.getErrorStream(), System.out, -1, 4096);
			baos.close();
			
			String s = baos.toString();
			return new JSONObject(s);
		}
		else
		{
			ByteArrayOutputStream baos = new ByteArrayOutputStream();
			BotUtil.sendData(p.getErrorStream(), baos, -1, 4096);
			baos.close();
			String s = baos.toString();
			
			JSONObject jo = new JSONObject();
			jo.put("status",  "err");
			jo.put("msg",  s);
			
			return jo;
		}
	}

}
