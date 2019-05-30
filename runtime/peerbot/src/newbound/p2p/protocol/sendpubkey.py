import json
from newbound.p2p.p2presponse import P2PResponse
import newbound.p2p.codes as Codes

class SEND_PUBKEY(object):
    def __init__(self, service):
        self.service = service

    def execute(self, data):
        sock = data['p2psocket']
        sock.parser.send(P2PResponse(Codes.PUBKEY, self.service.p2p.pub))
