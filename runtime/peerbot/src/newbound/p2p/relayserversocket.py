import os
from queue import Queue
import threading
from .relaysocket import RelaySocket


class RelayServerSocket(object):
    def __init__(self, p2p):
        self.p2p = p2p
        self.socks = {}
        self.incoming = Queue()
        self.running = True
        self._lock = threading.Lock()

    def relays(self, uuid):
        listt = []
        if uuid in self.socks:
            hashh = self.socks[uuid]
            for relay in hashh:
                listt.append(relay)
        return listt

    def addRelay(self, uuid, relay):
        print("adding RELAY to "+uuid+" via "+relay)
        with self._lock:
            if not uuid in self.socks: self.socks[uuid] = {}
            hash = self.socks[uuid]
            if not relay in hash or hash[relay].isClosed():
                sock = self.p2p.service.any(relay, 'TCPSocket')
                hash[relay] = RelaySocket(relay, uuid, sock)
                self.incoming.put(hash[relay])
            return hash[relay]

    def removeRelay(self, uuid, relay):
        print("removing RELAY to "+uuid+" via "+relay)
        with self._lock:
            if uuid in self.socks:
                hash = self.socks[uuid]
                if relay in hash:
                    sock = hash[relay]
                    hash.pop(relay)
                    sock.close()

    def accept(self):
        while self.running:
            try:
                return self.incoming.get(True, 5)
            except:
                pass

    def close(self):
        with self._lock:
            self.running = False
            for uuid in self.socks:
                hash = self.socks[uuid]
                for relay in hash:
                    sock = hash[relay]
                    delattr(hash, relay)
                    sock.close()

    def getPort(self):
        return -1
