from newbound.robot.botbase import BotUtil
from newbound.p2p.p2prequest import P2PRequest

class P2PParser(BotUtil):
    def init(self, service, sock):
        self.service = service
        self.sock = sock
        sock.parser = self

        typ = type(sock.sock).__name__
        if typ == 'TCPSocket':
            sock.sendall(sock.localid.encode())
            sock.sendall(self.bytes_to_int(self.sock.sock.getRemotePort()))
            ba = sock.readall(40)
            self.remoteid = ba[0:36].decode()
            self.remoteport = self.int_from_bytes(ba[36:])
        #self.peer = self.p2p.getPeer(self.remoteid, True)
        elif typ == 'RelaySocket':
            self.remoteid = sock.sock.uuid
            self.remoteport = -1
        else:
            print('FIXME - UNDEFINED')

        print('P2P connect '+self.remoteid)

        all = service.allsocks
        if not self.remoteid in all:all[self.remoteid] = []
        if typ == 'TCPSocket': all[self.remoteid].insert(0, sock)
        else: all[self.remoteid].append(sock)
        print('added p2p socket')

        service.p2p.isOK(self.remoteid, sock, None, None)

        return True

    def execute(self, request, cb):
        data = request.toDict()
        data['p2psocket'] = self.sock
        cb.execute(data)

    def parse(self):
        b = type(self.sock.sock).__name__ == 'RelaySocket'
        if b:
            pass

        code = self.int_from_bytes(self.sock.readall(4))
        llen = self.int_from_bytes(self.sock.readall(4))
        if llen<0 or llen>50000:
            print('Probably bad data '+str(llen)+' bytes')
        ba = self.sock.readall(llen)
        if not len(ba) == llen:
            print('ERROR: Unexpected data length parsing p2p request')
            sock.close()
            raise Exception('Malformed data')
        #print('incoming: '+str(code)+' - '+ba.hex())
        #self.peer.lastcontact = self.currentTimeMillis()
        return P2PRequest(self.sock, self.remoteid, code, ba)

    def send(self, response):
        b = type(self.sock.sock).__name__ == 'RelaySocket'
        ba = b''
        if b: ba += self.sock.sock.uuid.encode()
        ba += self.bytes_to_int(response.code)
        if not b: ba += self.bytes_to_int(len(response.data))
        ba += response.data
        self.sock.sendall(ba)
        #print('sent: '+ba.hex())

    def close(self):
        self.service.allsocks[self.remoteid].remove(self.sock)
        print('removed p2p socket')
