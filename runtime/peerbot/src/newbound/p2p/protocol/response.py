class RESPONSE(object):
    def __init__(self, service):
        self.service = service

    def execute(self, data):
        def doit():
            uuid = data['uuid']
            ba = data['data']
            sock = data['p2psocket']
            p = self.service.p2p.getPeer(uuid)
            ba = p.decrypt(ba)
            try:
                p.response(ba)
            except Exception as e:
                print('Error receiving p2p response '+str(e))
                self.service.p2p.printStackTrace(e)

        self.service.p2p.addJob(doit, 'Receiving P2P response')
