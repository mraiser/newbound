class STREAM(object):
    def __init__(self, service):
        self.service = service

    def execute(self, data):
        uuid = data['uuid']
        ba = data['data']
        sock = data['p2psocket']
        if self.service.p2p.isOK(uuid, sock, self.execute, data):
            p = self.service.p2p.getPeer(uuid)
            ba = p.decrypt(ba)
            p.stream(ba)
        # FIXME - on badpaddingexception set peer.readkey to null and call p2p.isOK
