package com.newbound.robot;

import java.util.Hashtable;

public class Global {
    private static final Hashtable<String, Object> GLOBAL = new Hashtable();

    public static void put(String name, Object val) {
        GLOBAL.put(name, val);
    }

    public static Object get(String name) {
        return GLOBAL.get(name);
    }
}
