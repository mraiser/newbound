import os
from queue import Queue

class RelayServerSocket(object):
    def __init__(self, p2p):
        self.p2p = p2p
        self.socks = {}
        self.incoming = Queue()
        self.running = True

    def addRelay(self, uuid, relay):
        if not uuid in self.socks: self.socks[uuid] = {}
        hash = self.socks[uuid]
        if not relay in hash or hash[relay].isClosed():
            hash[relay] = RelaySocket(relay, uuid)
            self.incoming = hash[relay]
        return hash[relay]

    def removeRelay(self, uuid, relay):
        if uuid in self.socks:
            hash = self.socks[uuid]
            if relay in hash:
                sock = hash[relay]
                delattr(hash, relay)
                sock.close()

    def accept(self):
        while self.running:
            try:
                return self.incoming.get(True, 5)
            except:
                pass

    def close(self):
        self.running = False
        for uuid in self.socks:
            hash = self.socks[uuid]
            for relay in hash:
                sock = hash[relay]
                delattr(hash, relay)
                sock.close()


    def getPort(self):
        return -1
