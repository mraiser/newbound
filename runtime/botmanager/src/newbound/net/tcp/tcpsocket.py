import socket

class TCPSocket(object):

    def __init__(self, conn, addr):
        self.conn = conn
        self.addr = addr
        self.bufsize = 4096
        self.rest = b''
        self.connected = True

    def isConnected(self):
        return self.connected

    def readall(self, num):
        n = 0
        ba = b''
        while (n<num):
            ba2 = self.read(num-n)
            n2 = len(ba2)
            if n2 == 0: break
            ba += ba2
            n += n2
        if (n<num): raise Exception('Unexpected EOF')
        return ba

    def read(self, num):
        n = len(self.rest)
        if n > 0:
            if n <= num:
                data = self.rest
                self.rest = b''
                return data
            else:
                data = self.rest[0:num]
                self.rest = self.rest[num:]
                return data
        return self.conn.recv(num)

    def readLine(self):
        if b'\n' in self.rest:
            i = self.rest.index(b'\n')
            data = self.rest[0:i-1]
            if data.endswith(b'\r'): data = data[:-1]
            self.rest = self.rest[i+1:]
            return data.decode("utf-8")
        else:
            more = b''
            try:
                more = self.conn.recv(self.bufsize)
            except Exception:
                pass
            if len(more) == 0:
                if len(self.rest) > 0:
                    data = self.rest
                    self.rest = b''
                    return data
                return None

            self.rest =  self.rest + more
            return self.readLine()

    def getRemoteAddress(self):
        return self.addr[0]

    def getRemotePort(self):
        return self.addr[1]

    def send(self, out):
        return self.conn.send(out)

    def sendall(self, out):
        self.conn.sendall(out)

    def close(self):
        self.connected = False
        self.conn.close()
