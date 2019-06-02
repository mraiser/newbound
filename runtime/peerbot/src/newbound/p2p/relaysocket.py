from queue import Queue

class RelaySocket(object):
    def __init__(self, relay, uuid, sock):
        self.relay = relay
        self.uuid = uuid
        self.sock = sock
        self.queue = Queue()

    def incoming(self, ba):
        self.queue.put(ba)

    def isClosed(self):
        return self.sock.isClosed()