import os
import json
from newbound.robot.botbase import BotUtil
from newbound.crypto.supersimplecipher import SuperSimpleCipher
from newbound.util.atomicint import AtomicInteger

class Peer(BotUtil):
    def __init__(self, p2p, uuid, p):
        self.p2p = p2p

        if uuid in p2p.peers.peers:
            raise("Attempt to create more than one instance of peer "+uuid)

        self.id = uuid
        self.name = 'UNKNOWN'
        if 'name' in p: self.name = p['name']

        self.pub = None
        self.readkey = None
        self.writekey = None
        self.addresses = []
        self.keepalive = False
        self.port = -1
        self.localid = -1 # FIXME - not used
        self.remoteid = -1 # FIXME - not used
        self.connected = False # FIXME - remove
        self.tcp = False
        self.udp = False # FIXME - not used
        self.lastcontact = 0
        self.nextsendcommand = AtomicInteger(0)
        self.commands = {}

        if 'pubkey' in p: self.pub = bytes.fromhex(p['pubkey'])
        if 'readkey' in p: self.readkey = SuperSimpleCipher(bytes.fromhex(p['readkey']))
        if 'writekey' in p:
            self.writekey = SuperSimpleCipher(bytes.fromhex(p['writekey']))
        else:
            self.writekey = SuperSimpleCipher(SuperSimpleCipher.getSeed())

        if 'addresses' in p:
            ja = json.loads(p['addresses'])
            for addr in ja: self.addSocketAddress(addr[0], addr[1])

        p2p.peers.peers[uuid] = self

    def setName(self, name):
        self.name = name
        self.p2p.fireEvent('update', self.toDict())
        self.p2p.peers.savePeer(self)

    def setPort(self, port):
        self.port = port
        self.p2p.fireEvent('update', self.toDict())
        self.p2p.peers.savePeer(self)

    def addSocketAddress(self, addr, port, front=False):
        if front:
            if [addr, port] in self.addresses: self.addresses.remove([addr, port])
            self.addresses.insert(0, [addr, port])
        elif not [addr, port] in self.addresses:
            self.addresses.append([addr, port])

    def setConnected(self, b):
        if b: self.lastcontact = self.currentTimeMillis()
        bb = self.connected
        self.connected = b
        if not bb == b:
            if bb: self.p2p.fireEvent('disconnect', self.toDict())
            else: self.p2p.fireEvent('connect', self.toDict())

    def isConnected(self):
        return self.p2p.available(self.id)

    def connect(self):
        self.p2p.connect(self.id)

    def toDict(self):
        d = {
            'id': self.id,
            'name': self.name,
            'connected': self.isConnected(),
            'addr': self.getAddress(),
            'port': self.port,
            'keepalive': self.keepalive,
            'localip': '127.0.0.1', # FIXME - not useful
            'localid': self.localid, # FIXME - not used
            'remoteid': self.remoteid, # FIXME - not used
            'lastcontact': self.lastcontact,
            'addresses': self.buildAddressList(),
            'relays': self.relays(),
            'tcp': self.p2p.isTCP(self.id),
            'udp': self.udp, # FIXME - not used
            'strength': self.p2p.strength(self)
        }
        return d

    #FIXME - combine with toDict
    def toProperties(self):
        d = {
            'uuid': self.id,
            'name': self.name,
            'addresses': json.dumps(self.addresses),
            'port': self.port,
            'keepalive': self.keepalive
        }

        if self.pub != None: d['pubkey'] = self.pub.hex()
        if self.readkey != None: d['readkey'] = self.readkey.key.hex()
        if self.writekey != None: d['writekey'] = self.writekey.key.hex()

        return d

    def toString(self):
        return json.dumps(self.toDict())

    def getAddress(self):
        if len(self.addresses) > 0: return self.addresses[0]
        return '127.0.0.1'

    def buildAddressList(self):
        ja = []
        for addr in self.addresses: ja.append(addr[0]+':'+str(addr[1]))
        return ja

    def relays(self):
        return self.p2p.relays(self.id)

    def encrypt(self, ba):
        return self.writekey.encrypt(ba)

    def decrypt(self, ba):
        return self.readkey.decrypt(ba)

    def response(self, msg):
        self.lastcontact = self.currentTimeMillis()
        mid = self.bytes_to_long(msg[:8])
        if not mid in self.commands:
            print('Unexpected response '+str(mid)+' from '+self.id)
        else:
            c = self.commands.pop(mid)
            s = msg[8:].decode()
            o = json.loads(s)
            print('RESPONSE ['+str(mid)+'] got '+s)
            def cb():
                c2 = c.cb(o)
                if not c2 == None:
                    self.sendCommandAsync(c2)
            self.p2p.addJob(cb)

    def sendCommandAsync(self, p2pcmd):
        self.p2p.sendCommand(self, p2pcmd)

    def command(self, msg):
        self.lastcontact = self.currentTimeMillis()
        mid = self.bytes_to_long(msg[0:8])
        s = msg[8:].decode()
        print('COMMAND['+str(mid)+'] got '+s)
        o = json.loads(s)
        bot = o['bot']
        cmd = o['cmd']
        params = o['params']
        b = self.p2p.container.getBot(bot)
        try:
            if b is None:
                raise Exception('App not available: '+bot)

            sb = self.p2p.container.getBot('securitybot')
            user = sb.getUser(self.id, True)  # FIXME - Affected by allow anonymous connections setting
            ses = sb.getSession(self.id, True)  # FIXME - needs double-blind session like HTTP
            ses['username'] = self.id
            ses['peer'] = self
            ses['displayname'] = self.name
            ses['user'] = user
            ses['emailusername'] = self.id  # FIXME - Should not have email bot functionality here
            ses['emailuser'] = user
            sb.validateRequest(b, cmd, params)
            r = b.handleCommand(cmd, params)
            print(json.dumps(r))
            t = type(r).__name__
            if t == 'str':
                o = b.newResponse()
                o['msg'] = r
                r = o
            self.p2p.respond(self, mid, r)
        except Exception as e:
            print('Error executing command ('+bot+'/'+cmd+'): '+str(e))
            r = {
                'status': 'err',
                'msg': str(e)
            }
            self.p2p.respond(self, mid, r)
