class P2PRequest(object):
    def __init__(self, sock, remoteid, code, ba):
        self.sock = sock
        self.remoteid = remoteid
        self.code = code
        self.data = ba

    def getCommand(self):
        return self.code

    def getData(self):
        return self.data

    def toDict(self):
        d = {
            'uuid': self.remoteid,
            'data': self.data
        }
        return d
