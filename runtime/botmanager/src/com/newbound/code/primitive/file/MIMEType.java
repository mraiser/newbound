package com.newbound.code.primitive.file;

import com.newbound.code.primitive.Primitive;
import com.newbound.net.mime.MIMEHeader;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;

public class MIMEType extends Primitive
{
	public MIMEType() throws JSONException {
		super("{ in: { path: {} }, out: { a: {} } }");
	}

	@Override
	public JSONObject execute(JSONObject in) 
	{
		JSONObject out = new JSONObject();
		String path = in.getString("path");
		String a = MIMEHeader.lookupMimeType(path);
		out.put("a", a);
		return out;
	}
}
