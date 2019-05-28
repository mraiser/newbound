package com.newbound.code.primitive;

import org.json.JSONException;
import org.json.JSONObject;

import com.newbound.robot.JSONTransform;;

public abstract class Primitive extends JSONObject implements JSONTransform 
{
	public Primitive(String string) throws JSONException {  super(string); }
	
	public static Number toNumber(Object a) 
	{
		if (a instanceof Number) return (Number)a;
		return Double.parseDouble(""+a);
	}

}
