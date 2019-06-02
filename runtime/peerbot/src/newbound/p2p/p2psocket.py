class P2PSocket(object):
    def __init__(self, service, localid, localport, sock):
        self.service = service
        self.sock = sock
        self.localid = localid
        self.localport = localport
        self.parser = None
        self.connecting = False

    def isConnected(self):
        return self.sock.isConnected()

    def close(self):
        self.sock.close()
        if not self.parser == None: self.parser.close()
        self.parser = None

    def sendall(self, data):
        self.sock.sendall(data)

    def readall(self, num):
        return self.sock.readall(num)

    def isClosed(self):
        return self.sock.isClosed()
