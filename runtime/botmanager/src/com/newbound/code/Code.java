package com.newbound.code;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.util.*;

import com.newbound.code.primitive.NativePrimitive;
import com.newbound.code.primitive.NativePrimitiveCall;
import com.newbound.code.primitive.math.*;
import com.newbound.code.primitive.object.*;
import com.newbound.code.primitive.string.Split;
import com.newbound.code.primitive.sys.Execute;
import com.newbound.code.primitive.sys.Sleep;
import com.newbound.code.primitive.sys.Time;
import com.newbound.robot.*;
import org.json.JSONArray;
import org.json.JSONObject;

import com.newbound.code.primitive.Primitive;
//import com.newbound.robot.Primitive;


public class Code 
{
	private static final boolean DEBUG = false;
	private static File ROOT = null;
	private boolean FINISHFLAG = false;

	public static JSONObject PRIMS = new JSONObject();
	public static String PYTHON = "python3"; //"/Library/Frameworks/Python.framework/Versions/3.6/bin/python3";

	public JSONObject CODE;
	public String LIB;

	static
	{
		try {
			try {
				String s = NativePrimitiveCall.list();
				JSONArray ja = new JSONArray(s);
				int n = ja.length();
				for (int i=0; i<n; i++) {
					JSONObject jo = ja.getJSONObject(i);
					String name = jo.getString("name");
					String io = jo.getString("io");
					PRIMS.put(name, new NativePrimitive(name, io));
				}
			}
			catch (Exception x) {
				x.printStackTrace();
				System.out.println("Native flow not installed (flowlib). Please install native flow library.");

				// MATH
				PRIMS.put("+", new Plus());
				PRIMS.put("-", new Minus());
				PRIMS.put("*", new Multiply());
				PRIMS.put("/", new Divide());
				PRIMS.put("%", new Mod());
				PRIMS.put("<", new LessThan());
				PRIMS.put("int", new Int());
				PRIMS.put("equals", new Equals());

				// STRING
				PRIMS.put("split", new Split());
				PRIMS.put("length", new Length());

				// OBJECT
				PRIMS.put("get", new Get());
				PRIMS.put("put", new Put());
				PRIMS.put("remove", new Remove());
				PRIMS.put("length", new Length());
				PRIMS.put("to_json", new ToJSON());
				PRIMS.put("has", new Has());

				//ARRAY
				PRIMS.put("insert", new Insert());

				// SYS
				PRIMS.put("time", new Time());
				PRIMS.put("sleep", new Sleep());
				PRIMS.put("execute_command", new Execute());

				// TCP
				PRIMS.put("tcp_listen", new NativePrimitive("tcp_listen", "{ in: { address: {}, port: {} }, out: { a: {} } }"));
				PRIMS.put("tcp_accept", new NativePrimitive("tcp_accept", "{ in: { listener: {} }, out: { a: {} } }"));
			}
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

		//FIXME - Total hack
		try {
			if (CODE.has("type") && CODE.get("type").equals("flow") && CODE.has("flow"))
				CODE = BotBase.getBot("botmanager").getData(LIB, CODE.getString("flow")).getJSONObject("data").getJSONObject("flow");
		}
		catch (Exception x) { x.printStackTrace(); }
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
				BotBase bb = BotBase.getBot("botmanager");

				String py = CODE.getString("id");
				String pyid = CODE.has("python") ? CODE.getString("python") : CODE.getString("cmd");
				JSONObject cmd = bb.getData(LIB, pyid).getJSONObject("data");
				return evalCommandLine(PYTHON, cmd, args, new File(getRoot(py), py+".py"));
			}

			if (type.equals("rust")) {
				BotManager bm = (BotManager)BotBase.getBot("botmanager");
				String homepath = bm.getProperty("rust_home");
				String id = CODE.getString("rust");
				JSONObject jo = bm.getData(LIB, id).getJSONObject("data");
				String ctl = jo.getString("ctl");
				String cmd = jo.getString("cmd");

				String[] sa = { "flow", LIB, ctl, cmd };
				File home = new File(homepath);
				ByteArrayInputStream bais = new ByteArrayInputStream(args.toString().getBytes());
				Process bogoproc = Runtime.getRuntime().exec(sa, null, home);
				sa = bm.systemCall(bogoproc, bais);

				if (!sa[1].equals("")) throw new Exception("ERROR: "+sa[1]);

				jo = new JSONObject(sa[0]);
				return jo;
			}

			int i;
			boolean done = false;
			
			JSONObject out = new JSONObject();
			CODE.put("out", out);
			
			FINISHFLAG = false;
			JSONObject currentcase = CODE;
			while (true) try
			{
				JSONArray cmds = currentcase.getJSONArray("cmds");
				JSONArray cons = currentcase.getJSONArray("cons");

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
								in.getJSONObject(key).put("done", false); // FIXME - why does this work? It breaks JS interpreter
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

				while (!done) {
					if (DEBUG) System.out.println("Evaluating connections...");
					boolean c = true;

					for (i = 0; i < n; i++) {
						JSONObject con = cons.getJSONObject(i);
						if (DEBUG) System.out.println("Evaluating connection " + i + ": " + con);
						if (!con.has("done") || !con.getBoolean("done")) {
							c = false;
							JSONArray ja = con.getJSONArray("src");
							int src = ja.getInt(0);
							String srcname = ja.getString(1);
							ja = con.getJSONArray("dest");
							int dest = ja.getInt(0);
							String destname = ja.getString(1);

							boolean b = false;
							Object val = null;
							if (src == -1) {
								val = args.has(srcname) ? args.get(srcname) : null;
								b = true;
								if (DEBUG) System.out.println("Value from input bar node " + srcname + " is " + val);
							} else {
								JSONObject cmd = cmds.getJSONObject(src);
								if (cmd.has("done") && cmd.getBoolean("done")) {
									JSONObject vals = cmd.getJSONObject("out");
									val = vals.has(srcname) ? vals.get(srcname) : null;
									b = true;
									if (DEBUG)
										System.out.println("Value from command " + src + " output node " + srcname + " is " + val);
								} else if (DEBUG)
									System.out.println("Value from command " + src + " output node " + srcname + " is not ready yet");
							}

							if (b) {
								if (DEBUG) System.out.println("Connection " + i + " is done");
								con.put("done", true);
								if (dest == -2) {
									if (val != null) out.put(destname, val);
									if (DEBUG)
										System.out.println("Value " + val + " passed to output node " + destname);
								} else {
									JSONObject cmd = cmds.getJSONObject(dest);
									if (cmd.getString("type").equals("undefined")) {
										cmd.put("done", true);
										if (DEBUG) System.out.println("Marking undefined command as done");
									} else {
										JSONObject ins = cmd.getJSONObject("in");
										JSONObject var = ins.getJSONObject(destname);
										if (val != null) var.put("val", val);
										var.put("done", true);

										Iterator it = ins.keys();
										while (it.hasNext() && b) {
											JSONObject in = ins.getJSONObject((String) it.next());
											b = b && in.has("done") && in.getBoolean("done");
										}

										if (DEBUG)
											System.out.println(b ? "All inputs to dest cmd done, evaluating" : "Not all inputs to cmd done yet");
										if (b)
											evaluate(cmd);
									}
								}
							}
						} else if (DEBUG) System.out.println("Connection " + i + " is done");

					}

					if (DEBUG)
						System.out.println(c ? "All connections had already fired. We must be done" : "One or more connections fired. Check all the commands");

					if (c) done = true;
				}
				break;
			}
			catch (NextCaseException x)
			{
				currentcase = currentcase.getJSONObject("nextcase");
			}
			catch (TerminateCaseException x)
			{
				break;
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

	private void evaluate(JSONObject cmd) throws Exception {
		JSONObject in = new JSONObject();
		JSONObject in2 = cmd.getJSONObject("in");
		Iterator keys = in2.keys();
		ArrayList list_in = new ArrayList();
		while (keys.hasNext()) {
			String name = (String) keys.next();
			JSONObject in3 = in2.getJSONObject(name);
			if (in3.has("val")) in.put(name, in3.get("val"));
			if (in3.has("mode") && in3.getString("mode").equals("list")) list_in.add(name);
			if (DEBUG) System.out.println(in3.has("val") ? "HAS " + name : "MISSING: " + name + "(" + in3 + ")");
		}
		if (DEBUG) System.out.println("in: " + in);
		if (DEBUG) System.out.println("in2: " + in2);

		JSONObject out2 = cmd.getJSONObject("out");
		keys = out2.keys();
		ArrayList list_out = new ArrayList();
		ArrayList loop_out = new ArrayList();
		while (keys.hasNext()) {
			String name = (String) keys.next();
			JSONObject out3 = out2.getJSONObject(name);
			if (out3.has("mode")) {
				String mode = out3.getString("mode");
				if (mode.equals("list")) list_out.add(name);
				else if (mode.equals("loop")) loop_out.add(name);
			}
		}

		int n = list_in.size();
		if (n == 0 && loop_out.size() == 0) evaluateOperation(cmd, in);
		else {
			JSONObject out3 = new JSONObject();
			for (int i = 0; i < list_out.size(); i++) out3.put((String) list_out.get(i), new JSONArray());
			int count = 0;
			if (n>0) {
				count = in.getJSONArray((String) list_in.get(0)).length();
				for (int i = 0; i < n; i++) count = Math.min(count, in.getJSONArray((String) list_in.get(i)).length());
			}

			int i = 0;
			while (true) {
				JSONObject in3 = new JSONObject();
				Iterator<String> list = in.keys();
				while (list.hasNext()) {
					String k = list.next();
					if (!list_in.contains(k)) in3.put(k, in.get(k));
					else {
						JSONArray ja = (JSONArray) in.get(k);
						in3.put(k, ja.get(i));
					}
				}

				evaluateOperation(cmd, in3);

				JSONObject out = cmd.getJSONObject("out");
				list = out2.keys();
				while (list.hasNext()) {
					String k = list.next();
					if (out.has(k)) { // FIXME - JS version outputs an undefined if no out[k]
						Object val = out.get(k);
						if (list_out.contains(k)) {
							out3.getJSONArray(k).put(val);
						} else {
							out3.put(k, val);
							if (loop_out.contains(k)) {
								String newk = out2.getJSONObject(k).getString("loop");
								in.put(newk, val);
							}
						}
					}
				}
				if (cmd.has("FINISHED") && cmd.getBoolean("FINISHED")) break;
				if (n>0) {
					i++;
					if (i == count) break;
				}
			}
			cmd.put("out", out3);
		}
	}

	private JSONObject deepCopy(JSONObject c){
		JSONObject o = new JSONObject();
		Iterator<String> i = c.keys();
		while (i.hasNext()){
			String key = i.next();
			Object val = c.get(key);
			if (val instanceof JSONObject) val = deepCopy((JSONObject)val);
			else if (val instanceof JSONArray) val = deepCopy((JSONArray)val);
			o.put(key, val);
		}
		return o;
	}

	private JSONArray deepCopy(JSONArray c) {
		JSONArray a = new JSONArray();
		int n = c.length();
		for (int i=0; i<n; i++){
			Object val = c.get(i);
			if (val instanceof JSONObject) val = deepCopy((JSONObject)val);
			else if (val instanceof JSONArray) val = deepCopy((JSONArray)val);
			a.put(val);
		}

		return a;
	}

	private void evaluateOperation(JSONObject cmd, JSONObject in) throws Exception
	{
		JSONObject out = null;
		String type = cmd.getString("type");

		boolean b = false;
		try {
			if (type.equals("primitive")) out = ((Primitive) PRIMS.get(cmd.getString("name"))).execute(in);
			else if (type.equals("local"))
			{
				JSONObject code = cmd.getJSONObject("localdata");
				code = deepCopy(code); // Fixme - evaluating a local shouldn't break it for reuse.
				Code c = new Code(code, LIB);
				out = c.execute(in);
				cmd.put("FINISHED", c.FINISHFLAG);
			}
			else if (type.equals("command")) {
				PeerBot pb = PeerBot.getPeerBot();
				String[] sa = cmd.getString("cmd").split(":");
				String lib = sa[0];
				String ctl = sa[1];
				String cmdname = sa[2];
				JSONObject jo = in;
				JSONObject params = new JSONObject();
				Iterator<String> list = jo.keys();
				while (list.hasNext()) {
					String k = list.next();
					params.put(k, jo.get(k));
				}

				// FIXME - add remote command support
				if (false) //(cmd.has("uuid"))
				{
					//String id = cmd.getString("uuid");
					//out = pb.sendCommand(id, bot, name, params);
				} else {
					String key = cmd.getJSONObject("out").keys().next().toString();
					out = new JSONObject();
					JSONObject src = BotBase.getBot("botmanager").getData(lib, cmdname).getJSONObject("data");
					Code code = new Code(src, lib);
					JSONObject val = code.execute(params);
					if (val.has("data")) {
						Object o = val.get("data");
						//					if (o instanceof File || o instanceof InputStream || o instanceof String)
						out.put(key, o);
					} else out.put(key, val);
				}
			}
			else if (type.equals("constant")) {
				out = cmd.getJSONObject("out");
				Iterator<String> i = out.keys();
				while (i.hasNext()) {
					String key = i.next();
					Object val = cmd.get("name");
					String ctype = cmd.getString("ctype");
					if (ctype.equals("int")) val = Integer.parseInt("" + val);
					else if (ctype.equals("decimal")) val = Double.parseDouble("" + val);
					else if (ctype.equals("boolean")) val = Boolean.parseBoolean("" + val);
					else if (ctype.equals("object")) val = new JSONObject("" + val);
					else if (ctype.equals("array")) val = new JSONArray("" + val);
					out.put(key, val);
				}
			}
			else if (type.equals("match"))
			{
				Iterator keys = in.keys();
				Object a = keys.hasNext() ? in.get((String) keys.next()) : null;
				String ctype = cmd.getString("ctype");
				if (ctype.equals("null")) b = a == null;
				else {
					Object val1 = a; //forceType(ctype, a);
					Object val2 = forceType(ctype, cmd.get("name"));
					b = val1 == null ? false : val1.equals(val2);
				}
				out = new JSONObject();
			}
			else if (type.equals("persistent"))
			{
				String key = cmd.getString("name");
				MetaBot mb = MetaBot.getMetaBot();
				if (in.length()>0) {
					Object a = in.get((String) in.keys().next());
					mb.global(key, a);
				}
				out = cmd.getJSONObject("out");
				Iterator<String> i = out.keys();
				Object val = mb.global(key);
				while (i.hasNext()) {
					key = i.next();
					out.put(key, val);
				}
			}
			else out = new JSONObject();

			if (!type.equals("match")) b = true;
		}
		catch (FailException x)
		{
			b = false;
			out = new JSONObject();
		}
		finally
		{
			if (!type.equals("constant") && cmd.has("condition")) {
				JSONObject condition = cmd.getJSONObject("condition");
				evaluateConditional(condition, b);
			}
			cmd.put("out", out);
			cmd.put("done", true);
		}
	}

	private void evaluateConditional(JSONObject condition, boolean m) throws Exception
	{
		String rule = condition.getString("rule");
		boolean b = condition.getBoolean("value");
		if (b == m)
		{
			if (rule.equals("next")) throw new NextCaseException();
			if (rule.equals("terminate")) throw new TerminateCaseException();
			if (rule.equals("fail")) throw new FailException();
			if (rule.equals("finish")) FINISHFLAG = true;
		}
	}

	private Object forceType(String atype, Object val) throws Exception
	{
		if (atype.equals("int"))
		{
			if (val instanceof Number) return (Integer)val;
			return Integer.parseInt(val.toString());
		}
		if (atype.equals("decimal"))
		{
			if (val instanceof Number) return (Double)val;
			return Double.parseDouble(val.toString());
		}
		if (atype.equals("boolean"))
		{
			if (val instanceof Boolean) return (Boolean)val;
			return Boolean.parseBoolean(val.toString());
		}
		if (atype.equals("string")) return val.toString();
		if (atype.equals("object"))
		{
			if (val instanceof JSONObject) return (JSONObject)val;
			return new JSONObject(val.toString());
		}
		if (atype.equals("array"))
		{
			if (val instanceof JSONArray) return (JSONArray)val;
			return new JSONArray(val.toString());
		}
		if (atype.equals("null"))
		{
			return null;
		}

		throw new Exception("Unknown type: "+atype);
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
		String[] call = new String[2]; //[i+2];
		call[0] = app;
		call[1] = py.getCanonicalPath();

		ByteArrayInputStream is = new ByteArrayInputStream(args.toString().getBytes());

		/*
		while (i-->0) 
		{
			String s = params.getJSONObject(i).getString("name");
			s = ""+args.get(s);
			call[i+2] = s;
		}
		*/

		try
		{
			String[] sa = BotUtil.systemCall(call, is);
			try
			{
				return new JSONObject(sa[0]);
			}
			catch (Exception xx)
			{
				JSONObject jo = new JSONObject();
				jo.put("status",  "err");
				jo.put("msg",  sa[1]);
				return jo;
			}
		}
		catch (Exception x)
		{
			JSONObject jo = new JSONObject();
			jo.put("status",  "err");
			jo.put("msg",  x.getMessage());
			return jo;
		}

/*
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

 */
	}

}
