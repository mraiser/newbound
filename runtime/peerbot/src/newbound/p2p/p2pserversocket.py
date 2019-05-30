import os
import json
import threading
import traceback
import sys
from queue import Queue
from newbound.net.tcp.tcpserversocket import TCPServerSocket
from .relayserversocket import RelayServerSocket
from .p2pcommand import P2PCommand

class P2PServerSocket(object):
    def __init__(self, p2p, uuid, port):
        self.p2p = p2p
        self.uuid = uuid
        self.port = port
        self.mod = 0

        self.incoming = Queue()
        self.running = True

        self.p2p.addNumThreads(3)

        self.tcp = TCPServerSocket(port)
        self.port = self.tcp.getPort()
        p2p.addJob(self.listenTCP, "P2P TCP listen on port "+str(self.port))

        self.relay = RelayServerSocket(p2p)
        p2p.addJob(self.listenRelay, "P2P relay listen")

        p2p.addPeriodicTask(self.maintenance, 5000, 'P2P SERVER SOCKET MAINTENANCE')

    def maintenance(self):
        self.p2p.service.maintenance()
        for thread in threading.enumerate(): print('THREAD: '+thread.name)
        self.mod += 1
        tcppeers = []
        uuids = ''
        for uuid in self.p2p.peers.peers:
            try:
                p = self.p2p.peers.peers[uuid]
                if self.p2p.isRelay(p): p.setConnected(True)
                if self.p2p.isTCP(p): tcppeers.append(uuid)
                else:
                    if not uuids == '': uuids += ' '
                    uuids += uuid
                if p.isConnected():
                    if p.lastcontact > 30000 or p.name == 'UNKNOWN' or p.port == -1:
                        params={}
                        def cb(result):
                            name = result['name']
                            localip = result['localip']
                            addr = result['addr']
                            port = int(result['port'])
                            if not name == p.name: p.setName(name)
                            if p.port == -1: p.setPort(port)
                            p.addSocketAddress(localip, port)
                            p.addSocketAddress(addr, port)
                            print('Heartbeat '+p.name+'/'+p.id)
                        cmd = P2PCommand("peerbot", "getpeerinfo", params, cb)
                        self.p2p.sendCommand(p, cmd)
                else:
                    if p.keepalive: p.connect()
            except Exception as e:
                print('error in maintenance loop for '+uuid+': '+str(e))
                traceback.print_exc(file=sys.stdout)
        if self.mod % 6 == 0:
            h = { 'uuids': uuids }
            for relay in tcppeers:
                self.checkpeers(relay, h)

    def checkPeers(self, relay, h):
        def cb(result):
            print('FIXME p2pss73')
            print(json.dumps(result))
            xxx
        cmd = P2PCommand('peerbot', 'lookup', h, cb)
        try:
            self.p2p.sendCommand(self.p2p.getPeer(relay), cmd)
        except Exception as e:
            print('error checking peers with '+relay+': '+str(e))
            traceback.print_exc(file=sys.stdout)

    def listenTCP(self):
        self.listen(self.tcp)

    def listenRelay(self):
        self.listen(self.relay)

    def listen(self, ss):
        #self.p2p.addNumThreads(1)
        while self.running:
            sock = ss.accept()
            self.incoming.put(sock)
        self.p2p.addNumThreads(-1)

    def accept(self):
        while self.running:
            try:
                sock = self.incoming.get(True, 5)
                psock = P2PSocket(self.p2p.service, self.uuid, self.port, sock)
            except:
                pass

    def getPort(self):
        return self.port

    def getAddress(self):
        return self.tcp.getAddress()
