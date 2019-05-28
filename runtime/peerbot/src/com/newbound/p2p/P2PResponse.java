package com.newbound.p2p;

import com.newbound.net.service.Response;

public class P2PResponse implements Response 
{
	int CODE;
	byte[] BA;
	
	public P2PResponse(int code, byte[] ba) 
	{
		CODE = code;
		BA = ba;
	}

	public int getCode() 
	{
		return CODE;
	}

	public byte[] getBytes() 
	{
		return BA;
	}

}
