import json
from newbound.p2p.p2presponse import P2PResponse
import newbound.p2p.codes as Codes

class SEND_READKEY(object):
    def __init__(self, service):
        self.service = service

    def execute(self, data):
        uuid = data['uuid']
        ba = data['data']
        sock = data['p2psocket']
        p = self.service.p2p.getPeer(uuid)
        print('Got read key request from '+uuid)
        sock.connecting = True
        if p.pub == None:
            #if not sock.connecting: # FIXME - this "if" may be why we need pubkey:22
            print('Cannot send read key without their public key, requesting from '+uuid)
            sock.parser.send(P2PResponse(Codes.SEND_PUBKEY, b''))
        else:
            # My write key is their read key
            ba = self.service.p2p.encryptWithPrivateKey(uuid, p.writekey.key)
            sock.parser.send(P2PResponse(Codes.READKEY, ba))
