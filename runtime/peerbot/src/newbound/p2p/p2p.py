import os
import json
import socket
from newbound.robot.botbase import BotUtil
from newbound.crypto.supersimplecipher import SuperSimpleCipher
from newbound.net.tcp.tcpsocket import TCPSocket
from newbound.p2p.p2presponse import P2PResponse
import newbound.p2p.codes as Codes
from .peermanager import PeerManager
from .p2pservice import P2PService
from .p2pserversocket import P2PServerSocket
from .p2psocket import P2PSocket
from .p2pparser import P2PParser

class P2P(BotUtil):
    def __init__(self, container, uuid, port, prv, pub):
        self.container = container
        self.uuid = uuid
        self.port = port
        self.prv = prv
        self.pub = pub
        self.peers = PeerManager(self, container.getRootDir())

    def setAllowAnon(self, b):
        #FIXME - This setting is ignored
        pass

    def start(self):
        self.service = P2PService(self, self.uuid, P2PServerSocket(self, self.uuid, self.port), "P2P")
        self.port = self.service.getPort()

    def isOK(self, uuid, sock, cb, data):
        if uuid == None:
            print("CANNOT CHECK IF PEER IS OK WITHOUT UUID")
        else:
            p = self.getPeer(uuid, False)
            if p != None:
                if p.pub != None and p.readkey != None:
                    sock.connecting = False
                    return True
                if not sock.connecting:
                    if p.pub == None:
                        sock.connecting = True
                        sock.parser.send(P2PResponse(Codes.SEND_PUBKEY, b''))
                    elif p.readkey == None:
                        sock.connecting = True
                        #FIXME
                        sock.parser.send(P2PResponse(Codes.PUBKEY, self.service.p2p.pub))
                        sock.parser.send(P2PResponse(Codes.SEND_READKEY, b''))
                    else:
                        return True
        if cb != None:
            def callback():
                cb(data)
            self.addJob(callback, 'P2PSocket connecting, waiting to execute command')
            print('P2PSocket connecting, waiting to execute command')
        return False

    def initiateTCPConnection(self, peer, addr=None, port=-1):
        if not addr == None:
            if not peer.tcp and not addr == '127.0.0.1':
                print('Initiating TCP connection to '+peer.name+' ('+peer.id+') at '+addr+':'+str(port))
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.connect((addr, port))
                print('Connected via TCP to '+peer.name+' ('+peer.id+') at '+addr+':'+str(port))
                tsock = TCPSocket(sock, [addr, port])
                psock = P2PSocket(self.service, self.uuid, self.port, tsock)
                parse = P2PParser()
                if parse.init(self.service, psock):
                    peer.setConnected(True)
                    peer.tcp = True # FIXME - set tcp on close or make tcp dynamic
                    print('Listening via TCP to '+peer.name+' ('+peer.id+') at '+addr+':'+str(port))
                    self.service.listen(psock, parse)
                    peer.addSocketAddress(addr, port, True)
        else:
            list = peer.addresses[0:]
            while len(list)>0:
                sa = list.pop(0)
                self.itcpa(peer, sa[0], sa[1])

    def itcpa(self, peer, addr, port):
        def cb():
            self.initiateTCPConnection(peer, addr, port)
        self.addJob(cb, 'Initiating TCP connection to '+peer.name+' ('+peer.id+') at '+addr+':'+str(port))

    def connect(self, uuid, addr = None, port = -1):
        p = self.getPeer(uuid, True)
        if not addr == None:
            p.addSocketAddress(addr, port, True)
        if self.isTCP(uuid):
            p.tcp = True
            p.setConnected(True)
        else:
            self.initiateTCPConnection(p)
            #if isUDP(uuid): p.setConnected(True)
            if self.isRelay(uuid): p.setConnected(True)
        return p

    def isTCP(self, uuid):
        sock = self.service.best(uuid)
        if sock == None: return False

        typ = type(sock.sock).__name__
        #print('BEST TYPE: '+typ)
        return typ == 'TCPSocket'

    def isRelay(self, uuid):
        sock = self.service.any(uuid, 'RelaySocket')
        return not sock == None

    def available(self, uuid, typ=None):
        sock = self.service.any(uuid, typ)
        return not sock == None

    def respond(self, p, mid, jo):
        d2 = json.dumps(jo).encode()
        d3 = self.long_to_bytes(mid)+d2
        self.sendBytes(Codes.RESPONSE, p, d3)

    def sendCommand(self, peer, cmd):
        id = peer.id
        if id == self.uuid: raise Exception('YOU SHALL NOT CONNECT TO YOURSELF!')
        if not self.available(id): self.connect(id)
        cmd.id = peer.nextsendcommand.inc()
        peer.commands[cmd.id] = cmd
        ba = cmd.toBytes()
        data = self.long_to_bytes(cmd.id)+ba
        self.sendBytes(Codes.COMMAND, peer, data)

    def sendBytes(self, code, p, ba):
        if code>199: ba = p.encrypt(ba)
        while True:
            best = self.service.best(p.id)
            if best == None:
                p.setConnected(False)
                break
            try:
                best.parser.send(P2PResponse(code, ba))
                return
            except Exception as e:
                print("Error sending bytes to "+p.id)
                self.printStackTrace(e)
                best.close()
        raise Exception("No route to host "+p.id)

    def encryptWithPrivateKey(self, uuid, ba):
        return SuperSimpleCipher([self.prv, self.getPublicKey(uuid)]).encrypt(ba)

    def decryptWithPrivateKey(self, uuid, ba):
        return SuperSimpleCipher([self.prv, self.getPublicKey(uuid)]).decrypt(ba)

    def getPublicKey(self, uuid):
        p = self.getPeer(uuid)
        return p.pub

    def fireEvent(self, event, data):
        self.container.fireEvent(event, data)

    def strength(self, peer):
        #FIXME - calculate strength
        return 0

    def relays(self, uuid):
        #FIXME - add relays from relayserversocket
        return []

    def getPeer(self, uuid, create=False):
        return self.peers.getPeer(uuid, create)

    def addNumThreads(self, num):
        self.container.addNumThreads(num)

    def addJob(self, runnable, name="UNTITLED"):
        self.container.addJob(runnable, name)

    def addPeriodicTask(self, pt, millis=None, name="P2P PERIODIC TASK", isrun=None, repeat=True):
        self.container.addPeriodicTask(pt, millis, name, isrun, repeat)

    def getLocalPort(self):
        return self.port

    def getLocalAddress(self):
        return self.service.getAddress()

    def hasPeer(self, id):
        return self.peers.hasPeer(id)

    def getPeer(self, uuid, create=True):
        return self.peers.getPeer(uuid, create)
