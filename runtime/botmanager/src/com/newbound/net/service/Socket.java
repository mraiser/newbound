package com.newbound.net.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.SocketAddress;

public interface Socket 
{
	public InputStream getInputStream() throws IOException;
	public OutputStream getOutputStream() throws IOException;
	public void close() throws IOException;
	public boolean isConnected();
	public boolean isClosed();
	public boolean isConnecting();
	public SocketAddress getRemoteSocketAddress();
	public String getRemoteHostName() throws IOException;
	public String getLocalHostName() throws IOException;
	public void setSoTimeout(int millis) throws IOException;
}
