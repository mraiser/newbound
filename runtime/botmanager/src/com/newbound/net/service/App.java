package com.newbound.net.service;

import java.io.File;
import java.net.URL;
import java.util.Hashtable;

import org.json.JSONObject;

import com.newbound.net.service.http.WebSocket;
import com.newbound.robot.Session;

public interface App 
{
	public void addJob(Runnable runnable, String string);
	public void fireEvent(String name, JSONObject event);
	public Session getSession(String c, boolean b);
	public File extractFile(String cmd);
	public URL extractURL(String cmd);
	public String getID();
	public String getIndexFileName();

	public Object handleCommand(String method, String cmd, Hashtable headers, Hashtable params) throws Exception;
	public void webSocketConnect(WebSocket webSocket, String cmd) throws Exception;
	public boolean running();
	public String getProperty(String string);
}
