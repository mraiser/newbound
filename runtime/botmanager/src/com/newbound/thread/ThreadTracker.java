package com.newbound.thread;

import java.util.*;
import java.io.*;

/**
 * Attempt to track and discover the linux "lightweight process id(s)"
 * (aka thread ids) of java threads.  100% accuracy is not guaranteed, but the 
 * resulting information can be a useful diagnostic.  Reads data directly from the 
 * linux /proc so-called-filesystem.
 * 
 * @author Charles Roth 8/2/2008.
 * 
 * Copyright (C) 2008 Q2Learning LLC.  All rights reserved.
 *
 * This class is published under the terms of the BSD open-source license, to wit:
 * Redistribution and use in source and binary forms, with or without modification, 
 * are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, 
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, 
 *    this list of conditions and the following disclaimer in the documentation 
 *    and/or other materials provided with the distribution.
 * 3. Neither the name of Q2Learning LLC nor the names of its contributors may be used 
 *    to endorse or promote products derived from this software without specific 
 *    prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" 
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE 
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE 
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE 
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES 
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; 
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON 
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT 
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF 
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

public class ThreadTracker {
	HashSet<String> threads;
	String parentId;

	public ThreadTracker() {
		parentId = readParentId();
		threads = new HashSet<String>(150);
		String[] threadIds = getThreadIds();
		for (String id : threadIds)
			threads.add(id.trim());
	}

	/**
	 * @return parent process id of all the threads in this application.
	 */
	public String getParentId() {
		return parentId;
	}
	

	/**
	 * @return Array of this process's current thread ids.
	 * May change from call to call.
	 */
	public static String[] getThreadIds() {
		String[] threadIds = new String[0];
		try {
			File threadDir = new File("/proc/self/task");
			threadIds = null2Empty(threadDir.list());
		} catch (Exception e) {
		}
		return threadIds;
	}

	/**
	 * @return Array of all new threads in this process since this
	 * ThreadTracker object was created.
	 */
	public String[] getNewThreadIds() {
		ArrayList<String> newIds = new ArrayList<String>();
		String[] newThreads = getThreadIds();
		for (String t : newThreads) {
			if (!threads.contains(t))
				newIds.add(t);
		}
		return newIds.toArray(new String[0]);
	}

	/**
	 * Call immediately after creating (and starting) a new thread.
	 * @return Best guess as to linux "lightweight process id" of the new thread.
	 */
	public String guessNewLinuxThreadId() {
		String[] newIds = getNewThreadIds();
		if (newIds.length == 0)
			return "unknown";
		if (newIds.length == 1)
			return newIds[0];
		
//		StringBuffer guess = new StringBuffer();
//		guess.append(newIds[0]);
//		for (int i = 1; i < newIds.length; ++i)
//			guess.append(" " + newIds[i]);
//		return guess.toString();
		
		return newIds[newIds.length-1];
	}

	/**
	 * Sample test main program to demonstrate usage.
	 * @param args
	 */
	public static void main(String[] args) {
		ThreadTracker tt = new ThreadTracker();
		for (String s : tt.threads) {
			System.out.println("linux thread id = " + tt.parentId + " " + s);
		}
		Thread t = new Thread(new Runnable() {
			public void run() {
				while (true) {
					try {
						Thread.sleep(1000);
					} catch (Exception e) {
					}
				}
			}
		});
		t.start();

		System.out.println(tt.guessNewLinuxThreadId());
	}

	private static String readParentId() {
		BufferedReader in = readerFromFileName("/proc/self/stat");
		String line = safelyReadLine(in);
		if (line == null) return "0";
		int blankPos = line.indexOf(" ");
		if (blankPos < 0) return "0";
		return line.substring(0, blankPos);
	}

	private static String[] null2Empty(String[] x) {
		return (x != null ? x : new String[0]);
	}

	protected static BufferedReader readerFromFileName(String fileName) {
		BufferedReader in = null;
		try {
			File file = new File(fileName);
			InputStream stream = new FileInputStream(file);
			InputStreamReader reader = new InputStreamReader(stream);
			in = new BufferedReader(reader);
		} catch (Exception e) {
		}
		return in;
	}

	protected static String safelyReadLine(BufferedReader in) {
		if (in == null)
			return null;
		String line = null;
		try {
			line = in.readLine();
		} catch (Exception e) {
		}
		return line;
	}
}