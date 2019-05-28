package com.newbound.net.service.http;

import java.util.Hashtable;

import org.json.JSONObject;

import com.newbound.net.service.Request;

public class HTTPRequest implements Request 
{
	String CMD;
	String LOC;
	String METHOD;
	Hashtable HEADERS;
	Hashtable PARAMS;

	JSONObject log = new JSONObject();
	
	public HTTPRequest(String protocol, String method, String cmd, Hashtable headers, Hashtable params, String loc) 
	{
		try {
			CMD = cmd;
			LOC = loc;
			METHOD = method;
			HEADERS = headers;
			PARAMS = params;

			long now = System.currentTimeMillis();
			log.put("timestamp", now);
			log.put("method", method);
			log.put("path", cmd);
			log.put("protocol", protocol);
			log.put("language", "" + headers.get("ACCEPT-LANGUAGE"));

			String sid = "";
			String c = (String) headers.get("COOKIE");
			if (c != null) {
				String[] cs = c.split("; ");
				for (int i = 0; i < cs.length; i++)
					if (cs[i].startsWith("sessionid=")) {
						sid = cs[i].substring(10);
						headers.put("nn-sessionid", sid);
						break;
					}
			}
			log.put("sessionid", sid);

			String h = (String) headers.get("HOST");
			log.put("HOST", h != null ? h : "");

			String r = (String) headers.get("REFERER");
			log.put("REFERER", r != null ? r : "");
		}
		catch (Exception x) { x.printStackTrace(); }
	}

	@Override
	public Object getCommand() 
	{
		return CMD;
	}

	@Override
	public JSONObject getData() 
	{
		JSONObject jo = new JSONObject();

		try
		{
			jo.put("cmd", CMD);
			jo.put("loc", LOC);
			jo.put("method", METHOD);
			jo.put("headers", new JSONObject(HEADERS));
			jo.put("log", new JSONObject(PARAMS));
		}
		catch (Exception x) { x.printStackTrace(); }

		return jo;
	}

}
