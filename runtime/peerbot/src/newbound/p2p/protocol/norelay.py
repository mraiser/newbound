class NORELAY(object):
    def __init__(self, service):
        self.service = service

    def execute(self, data):
        relay = data['uuid']
        target = data['data'][:36].decode()
        sock = data['p2psocket']
        print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        print(' REMOVING RELAY '+relay+' from '+target)
        print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        sock.service.p2p.removeRelay(target, relay)
