from queue import Queue
from newbound.p2p.p2presponse import P2PResponse
import newbound.p2p.codes as Codes

class RelaySocket(object):
    def __init__(self, relay, uuid, sock):
        self.relay = relay
        self.uuid = uuid
        self.sock = sock
        self.queue = Queue()
        self.buf = b''

    def incoming(self, ba):
        if self.sock is None:
            raise Exception("Incoming data on closed relay to "+self.uuid+" via "+self.relay)
        self.queue.put(ba)

    def isConnected(self):
        if self.sock is None:
            return False
        return self.sock.isConnected()

    def isClosed(self):
        if self.sock is None:
            return True
        return self.sock.isClosed()

    def readall(self, n):
        l = len(self.buf)
        if l >= n:
            ba = self.buf[:n]
            self.buf = self.buf[n:]
            return ba
        else:
            ba = self.buf
            self.buf = self.queue.get()
            ba += self.readall(n-l)
            return ba

    def sendall(self, ba):
        if self.sock is None:
            raise Exception("Attempt to send data on closed relay to "+self.uuid+" via "+self.relay)
        self.sock.parser.send(P2PResponse(Codes.RELAY, ba))

    def close(self):
        self.sock = None
