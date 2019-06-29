from newbound.p2p.p2presponse import P2PResponse
from newbound.util.inputbuffer import InputBuffer
import newbound.p2p.codes as Codes

class RelaySocket(object):
    def __init__(self, relay, uuid, sock):
        self.relay = relay
        self.uuid = uuid
        self.sock = sock
        self.buff = InputBuffer()

    def incoming(self, ba):
        if self.sock is None:
            raise Exception("Incoming data on closed relay to "+self.uuid+" via "+self.relay)
        self.buff.incoming(ba)

    def isConnected(self):
        if self.sock is None:
            return False
        return self.sock.isConnected()

    def isClosed(self):
        if self.sock is None:
            return True
        return self.sock.isClosed()

    def readall(self, n):
        return self.buff.readall(n)

    def sendall(self, ba):
        if self.sock is None:
            raise Exception("Attempt to send data on closed relay to "+self.uuid+" via "+self.relay)
        self.sock.parser.send(P2PResponse(Codes.RELAY, ba))

    def close(self):
        self.sock = None
