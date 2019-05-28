package com.newbound.util;

import java.io.File;
import java.io.FilenameFilter;

public class NoDotFilter implements FilenameFilter
{

	public boolean accept(File dir, String name)
	{
		return !name.startsWith(".");
	}

}
