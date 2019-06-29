# nee p2pconnection

import os
from .p2presponse import P2PResponse
from .codes import STREAM
from newbound.util.inputbuffer import InputBuffer
from newbound.robot.botbase import BotUtil


class P2PStream(BotUtil):
    def __init__(self, peer, id=-1):
        self.peer = peer
        self.buf = InputBuffer()
        if id == -1:
            id = self.random()
        self.id = id
        self.parser = None

    def random(self):
        ba = os.urandom(8)
        return self.bytes_to_long(ba)

    def connect(self):
        con = self.peer.p2p.service.best(self.peer.id)
        if con is None:
            raise Exception('Not connected to peer '+self.peer.name+' ('+self.peer.id+')')
        self.parser = con.parser
        self.peer.streams[self.id] = self

    def isConnected(self):
        if self.parser is None:
            return False
        return self.parser.sock.isConnected()

    def close(self):
        if self.parser is not None:
            self.parser.close()
            self.parser = None
        if self.id in self.peer.streams:
            self.peer.streams.pop(self.id)

    def sendall(self, data):
        ba = self.peer.encrypt(data)
        self.parser.send(P2PResponse(STREAM, ba))

    def readall(self, num):
        return self.buf.readall(num)

    def incoming(self, ba):
        self.buf.incoming(ba)
