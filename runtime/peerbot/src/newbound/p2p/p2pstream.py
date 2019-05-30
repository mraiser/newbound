#nee p2pconnection

class P2PStream(object):
    def __init__(self, peer, id=-1):
        self.peer = peer
        if id == -1: id = self.random()
        self.id = id

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
