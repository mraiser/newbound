package com.newbound.util;

public class RollingAverage 
{
	double[] d;
	double t;
	int n;
	
	int i = 0;

	public RollingAverage(int len, double startval) 
	{
		n = len;
		d = new double[n];
		t = startval * n;
		while (len-->0) d[len] = startval;
	}
	
	public void add(double v)
	{
		t = t - d[i] + v;
		d[i++] = v;
		if (i == n) i = 0;
	}
	
	public double value()
	{
		return t/n;
	}

	public double value(double v)
	{
		add(v);
		return value();
	}
	
	public static void main(String[] args) 
	{
		RollingAverage avg = new RollingAverage(10, 0);
		for (int i=0;i<1000;i++) System.out.println(avg.value(i));
	}
}
