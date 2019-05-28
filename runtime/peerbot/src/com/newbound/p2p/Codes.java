package com.newbound.p2p;

public class Codes 
{
	// P2P
	public static final int RELAY = 1;
	public static final int RELAYED = 2;
//	public static final int PING = 3;
//	public static final int PONG = 4;
//	public static final int RESEND = 5;
//	public static final int ACK = 6;
//	public static final int CONNECT = 7;
//	public static final int WELCOME = 8;
//	public static final int CHUNK = 9;
//	public static final int PART = 10;
//	public static final int SIZE = 11;
//	public static final int WIPE = 12;
	public static final int NORELAY = 13;
//	public static final int TUNNEL = 14;
	public static final int KEEPALIVE = 15;
//	public static final int KEPTALIVE = 16;
//	public static final int UDPSTATUS = 17;
//	public static final int ALLCLEAR = 18;

	// Crypto
	public static final int SEND_PUBKEY = 100;
	public static final int PUBKEY = 101;
	public static final int SEND_READKEY = 102;
	public static final int READKEY = 103;
//	public static final int FIND = 104;
//	public static final int FOUND = 105;
	
	// Commander
	public static final int STREAM = 200;
	public static final int COMMAND = 201;
	public static final int RESPONSE = 202;
	public static final int STREAM_DIED = 203;
}
