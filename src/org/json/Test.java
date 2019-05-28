package org.json;

public class Test {

	public static void main(String[] args)
	{
		try
		{
			JSONObject o = new JSONObject("{\"id\":\'1dec6502-16fb-4578-8050-e522db85f9c8\',\'cmd\':\'local\',\'bot\':\'peerbot\',\'params\':{\'peer\':\'702f72d1-daed-44d7-b6e1-7c3c2c1b33e6\',\'stream\':\'0\',\'params\':\'{\\\'sessionid\\\':\\\'141468066c7ikugjmgvuqswvpyqlkzw\\\'}\',\'url\':\'currencybot/accountinfo\'}}");
			o.put("xxx", "\\u2022");
			o.put("yyy", "\u2022");
			o.put("zzz", "\\\\");
			System.out.println(o);
		}
		catch (Exception x) { x.printStackTrace(); }
	}

}
