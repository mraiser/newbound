class KEEPALIVE(object):
    def __init__(self, service):
        self.service = service

    def execute(self, data):
        uuid = data['uuid']
        sock = data['p2psocket']
        print('Got KEEPALIVE from '+uuid+' via '+type(sock.sock).__name__)
