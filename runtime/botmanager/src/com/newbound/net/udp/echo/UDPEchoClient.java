package com.newbound.net.udp.echo;

import com.newbound.net.service.Socket;
import com.newbound.net.udp.UDPServerSocket;
import com.newbound.robot.BotUtil;

import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;

public class UDPEchoClient {
    public static void main(String[] args)
    {
        try {
            UDPServerSocket USS = new UDPServerSocket(null, 57591);
            Socket sock = USS.connect(new InetSocketAddress("localhost", 57590));
            //sock.setSoTimeout(240000);
            while (true) try {
                String s = "I am the very model of a modern major general.";
                int n = 0;
                for (int i=0; i<100; i++) {
                    String sss = s + " (" + i + ") ";
                    n += sss.length();
                    sock.getOutputStream().write(sss.getBytes());
                }
                sock.getOutputStream().flush();
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                BotUtil.sendData(sock.getInputStream(), baos, n, n);
                baos.close();
                System.out.println(new String(baos.toByteArray()));
                Thread.sleep(1000);
            } catch (Exception e) {
                e.printStackTrace();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
