import os
import traceback
import sys
from newbound.net.service.service import Service
from newbound.p2p.protocol.relay import RELAY
from newbound.p2p.protocol.relayed import RELAYED
from newbound.p2p.protocol.norelay import NORELAY
from newbound.p2p.protocol.stream import STREAM
from newbound.p2p.protocol.command import COMMAND
from newbound.p2p.protocol.response import RESPONSE
from newbound.p2p.protocol.streamdied import STREAM_DIED
from newbound.p2p.protocol.sendpubkey import SEND_PUBKEY
from newbound.p2p.protocol.pubkey import PUBKEY
from newbound.p2p.protocol.sendreadkey import SEND_READKEY
from newbound.p2p.protocol.readkey import READKEY
from newbound.p2p.protocol.keepalive import KEEPALIVE
from .p2pparser import P2PParser

import newbound.p2p.codes as Codes

class P2PService(Service):
    def __init__(self, p2p, uuid, serversocket, name):
        super().__init__(serversocket, name, self.newParser, p2p)
        self.p2p = p2p
        self.uuid = uuid
        self.allsocks = {}

        self.on(Codes.RELAY, RELAY(self))
        self.on(Codes.RELAYED, RELAYED(self))
        self.on(Codes.NORELAY, NORELAY(self))

        self.on(Codes.STREAM, STREAM(self))
        self.on(Codes.COMMAND, COMMAND(self))
        self.on(Codes.RESPONSE, RESPONSE(self))
        self.on(Codes.STREAM_DIED, STREAM_DIED(self))

        self.on(Codes.SEND_PUBKEY, SEND_PUBKEY(self))
        self.on(Codes.PUBKEY, PUBKEY(self))
        self.on(Codes.SEND_READKEY, SEND_READKEY(self))
        self.on(Codes.READKEY, READKEY(self))

        self.on(Codes.KEEPALIVE, KEEPALIVE(self))

    def newParser(self):
        return P2PParser()

    def any(self, uuid, typ=None):
        if uuid in self.allsocks:
            for sock in self.allsocks[uuid]:
                if typ == None or type(sock.sock).__name__ == typ: return sock
        return None

    def best(self, uuid):
        if uuid in self.allsocks:
            if len(self.allsocks[uuid])>0:
                return self.allsocks[uuid][0]
        return None

    def getRelay(self, target, relay):
        return self.serversocket.getRelay(target, relay)

    def maintenance(self):
        # FIXME
        pass

    def socketloop(self, s, p):
        self.container.addNumThreads(2)
        try:
            super().socketloop(s, p)
        except Exception as e:
            traceback.print_exc(file=sys.stdout)
        self.container.addNumThreads(-2)

