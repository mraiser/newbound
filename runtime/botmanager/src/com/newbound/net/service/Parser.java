package com.newbound.net.service;

import com.newbound.robot.Callback;

public interface Parser
{
	public boolean init(Service service, Socket sock) throws Exception;
	public Request parse() throws Exception;
	public void send(Response response) throws Exception;
	public void close() throws Exception;
	public void error(Exception x);
	public void execute(Request data, Callback cb) throws Exception;
}