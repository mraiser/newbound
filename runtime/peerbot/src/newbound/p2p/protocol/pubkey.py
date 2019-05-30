import json
from newbound.p2p.p2presponse import P2PResponse
import newbound.p2p.codes as Codes

class PUBKEY(object):
    def __init__(self, service):
        self.service = service

    def execute(self, data):
        uuid = data['uuid']
        ba = data['data']
        sock = data['p2psocket']
        p = self.service.p2p.getPeer(uuid)
        if p.pub != None:
            print("Received pubkey for "+uuid+" but we already have one. Ignoring.")
        else:
            p.pub = ba
            self.service.p2p.peers.savePeer(p)
        if p.readkey == None:
            sock.connecting = True
            #FIXME - should not need to send pubkey
            sock.parser.send(P2PResponse(Codes.PUBKEY, self.service.p2p.pub))
            sock.parser.send(P2PResponse(Codes.SEND_READKEY, b''))
        self.service.p2p.isOK(uuid, sock, None, None)
