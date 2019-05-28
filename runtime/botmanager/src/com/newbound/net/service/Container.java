package com.newbound.net.service;

import java.io.File;

public interface Container {
	public App find(String id);
	public App getDefault();
	public File extractLocalFile(String path);
	public String getLocalID();
	public String getMachineID();
}
