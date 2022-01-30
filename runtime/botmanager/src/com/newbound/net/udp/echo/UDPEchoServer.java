package com.newbound.net.udp.echo;

import com.newbound.net.service.*;
import com.newbound.net.udp.UDPServerSocket;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;

public class UDPEchoServer {
    UDPServerSocket SOCK;

    public  UDPEchoServer(int port) throws IOException {
        super();
        SOCK = new UDPServerSocket(null, port);
    }

    public Socket connect(InetSocketAddress isa) throws IOException {
        return SOCK.connect(isa);
    }

    public static void main(String[] args)
    {
        try {
            UDPEchoServer UES = new UDPEchoServer(57590);
            while (true) {
                final Socket sock = UES.SOCK.accept();
                //sock.setSoTimeout(240000);
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            InputStream is = sock.getInputStream();
                            OutputStream os = sock.getOutputStream();
                            byte[] buf = new byte[4096];
                            while (true) {
                                int n = is.read(buf);
                                System.out.println(new String(buf, 0, n));
                                os.write(buf, 0, n);
                                os.flush();
                            }
                        }
                        catch (Exception x) { x.printStackTrace(); }
                    }
                }).start();
            }
        }
        catch (Exception e) {
            e.printStackTrace();
        }
    }
}
