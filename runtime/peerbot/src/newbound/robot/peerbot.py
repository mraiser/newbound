import os
import json
import sys
import traceback
from newbound.robot.botbase import BotBase
from newbound.crypto.supersimplecipher import SuperSimpleCipher
from newbound.p2p.p2p import P2P
from newbound.p2p.p2pcommand import P2PCommand

class PeerBot(BotBase):
    def getServiceName(self):
        return 'peerbot'

    def init(self, root, master):
        super().init(root, master)
        b = False
        if not 'uuid' in self.properties:
            self.properties['uuid'] = self.new_uuid()
            b = True
        aa = False
        if not 'allowanon' in self.properties:
            self.properties['allowanon'] = 'false'
            b = True
        else:
            aa = self.properties['allowanon'] == 'true'
        p = 0
        if 'udpport' in self.properties:
            p = int(self.properties['udpport'])
        ad = None
        if 'localaddress' in self.properties:
            ad = self.properties['localaddress']
        else:
            ad = self.get_ip()
        if not 'privatekey' in self.properties:
            kp = SuperSimpleCipher.generateKeyPair()
            self.properties['privatekey'] = kp[0].hex()
            self.properties['publickey'] = kp[1].hex()
            b = True
        if b:
            self.saveSettings()

        uuid = self.properties['uuid']
        prv = bytes.fromhex(self.properties['privatekey'])
        pub = bytes.fromhex(self.properties['publickey'])
        self.P2P = P2P(self, uuid, p, prv, pub)
        self.P2P.setAllowAnon(aa)
        self.P2P.start()
        if p == 0 or p == -1:
            pp = self.P2P.getLocalPort()
            self.properties['udpport'] = str(pp)
            self.saveSettings()

    def initializationComplete(self):
        super().initializationComplete()
        self.addPeriodicTask(self.check_brokers, 5000, "Check Brokers")

    def check_brokers(self):
        try:
            f = os.path.join(self.root, 'broker.txt')
            p = self.load_properties(f)
            if not p == None:
                for uuid in p:
                    try:
                        peer = self.P2P.getPeer(uuid, True)
                        sa = p[uuid].split(':')
                        addr = sa[0]
                        port = int(sa[1])
                        self.P2P.initiateTCPConnection(peer, addr, port)
                    except Exception as e:
                        print('Error checking on broker: '+uuid+' / '+str(e))
                        #traceback.print_exc(file=sys.stdout)
        except Exception as e:
            print('Error checking on the brokers: '+str(e))
            traceback.print_exc(file=sys.stdout)

    def handleCommand(self, cmd, params):
        if cmd == 'register': return self.handleRegister(params)
        if cmd == 'noop': return self.handleNOOP(params)
        if cmd == 'lookup': return self.handleLookUp(params)
        if cmd == 'listzeroconf': return self.handleListZeroConf(params)
        if cmd == 'getpeerid': return self.handleGetPeerID(params)
        if cmd == 'getpeerinfo': return self.handleGetPeerInfo(params)
        if cmd == 'getmachineid': return self.handleGetMachineID(params)
        if cmd == 'connectionstatus': return self.handleConnectionStatus(params)
        if cmd == 'connect': return self.handleConnect(params)
        if cmd == 'newconnection': return self.handleConnect(params)
        if cmd == 'disconnect': return self.handleDisconnect(params)
        if cmd.startswith('remote/'): return self.handleRemote(cmd[7:], params)
        if cmd == 'local': return self.handleLocal(params)
        if cmd == 'stream': return self.handleStream(params)
        if cmd == 'websocket': return self.handleWebsocket(cmd, params)
        if cmd == 'connections': return self.handleConnections(params)
        if cmd == 'accesscodes': return self.handleAccessCodes(params)
        if cmd == 'suggestaccesscode': return self.handleSuggestAccessCode(params)
        if cmd == 'addaccesscode': return self.handleAddAccessCode(params)
        if cmd == 'accesscode': return self.handleAccessCode(params)
        if cmd == 'deleteaccesscode': return self.handleDeleteAccessCode(params)
        if cmd == 'togglekeepalive': return self.handleToggleKeepAlive(params)
        if cmd == 'deletepeer': return self.handleDeletePeer(params)
        if cmd == 'tempfile': return self.handleTempfile(params)
        if cmd == 'allowanon': return self.handleAllowAnon(params)
        if cmd == 'subscribe': return self.handleSubscribe(params)
        if cmd == 'available': return self.handleAvailable(params) # NOTE returns boolean
        if cmd == 'pubkey': return self.handlePubKey(params)
        if cmd == 'brokers': return self.handleBrokers(params)

        raise Exception("Unknown command: "+cmd)

    def handleBrokers(self, params):
        f = os.path.join(self.root, 'broker.txt')
        jo2 = {}
        if 'brokers' in params:
            b = params['brokers']
            jo2 = json.loads(b)
            self.store_properties(jo2, f)
        elif (os.path.exists(f)):
            jo2 = self.load_properties(f)
        jo = self.newResponse()
        jo['brokers'] = jo2
        return jo

    def handlePubKey(self, params):
        if not 'uuid' in params or params['uuid'] == self.getLocalID():
            return self.P2P.pub.hex()
        else:
            uuid = params['uuid']
            if self.P2P.hasPeer(uuid):
                p = self.P2P.getPeer(uuid)
                if p.pub != None:
                    return p.pub.toHex()
        raise Exception("Do not have public key for: "+uuid)

    def handleAvailable(self, params):
        uuid = params['uuid']
        return self.P2P.available(uuid)

    def handleSubscribe(self, params):
        uuid = params['sessionid']
        bot = params['bot']
        channel = params['channel']
        p = self.P2P.getPeer(uuid)
        d = p.toDict()
        sock = p.newStream()
        bb = self.getBot(bot)
        bb.addSubscriber(channel, d, sock)

        jo = self.newResponse()
        jo['stream'] = sock.id
        return jo

    def handleAllowAnon(self, params):
        allow = params['allow']
        self.P2P.setAllowAnon(allow == 'true')
        self.properties['allowanon'] = allow
        self.saveSettings()
        return 'OK'

    def handleTempfile(self, params):
        sid = params['sessionid']
        id = params['id']
        f = self.getTempFile(id)
        llen = os.path.getsize(f)
        con = self.P2P.getPeer(sid).newStream()
        stream = con.id

        o = self.newResponse()
        o['stream'] = stream
        o['len'] = llen

        def cb():
            fis = open(f, "rb")
            self.sendData(fis, con, llen, 4096)
            fis.close()
            con.close()

    def handleDeletePeer(self, params):
        id = params['uuid']
        self.P2P.deletePeer(id)
        return self.newResponse()

    def handleToggleKeepAlive(self, params):
        id = params['uuid']
        keepalive = params['keepalive'] == 'true'
        p = self.P2P.getPeer(id, False)
        p.keepalive = keepalive
        self.P2P.peers.savePeer(p)

        if keepalive:
            self.P2P.connect(id)
            d = {
                'uuid': self.getLocalID(),
                'local': self.getLocalAddress(),
                'port': self.getLocalPort()
            }
            p.sendCommand('peerbot', 'register', d)

        return p.toDict()

    def handleDeleteAccessCode(self, params):
        f = os.path.join(self.getRootDir(), 'invites')
        code = params['code']
        f = os.path.join(f, code)
        os.remove(f)
        return 'OK'

    def handleAccessCode(self, params):
        uuid = params['uuid']
        code = params['code']
        f = os.path.join(self.getRootDir(), 'invites')
        f = os.path.join(f, code)
        if os.path.exists(f):
            p = self.loadProperties(f)
            groups = p['groups']
            delete = p['delete']
            self.setGroups(uuid, groups)
            if delete == 'true':
                os.remove(f)
            return self.newResponse()
        raise Exception('Invalid access code: '+code)

    def handleAddAccessCode(self, params):
        code = params['code']
        if len(code) < 4 or not self.lettersAndNumbersOnly(code) == code:
            raise Exception('Access codes must be at least 4 characters long and consist of letters and numbers only')

        groups = params['groups']
        if groups == '':
            raise Exception('You must specify at least one group')

        f = os.path.join(self.getRootDir(), 'invites')
        self.mkdirs(f)
        f = os.path.join(f, code)
        p = {
            'delete': params['delete'],
            'groups': groups
        }
        self.store_properties(p, f)
        return 'OK'

    def handleSuggestAccessCode(self, params):
        return self.uniqueSessionID()

    def handleAccessCodes(self, params):
        f = os.path.join(self.getRootDir(), 'invites')
        self.mkdirs(f)
        codes = os.listdir(f)
        jo = {}
        for code in codes:
            f2 = os.path.join(f, code)
            p = self.load_properties(f2)
            jo[code] = p
        out = self.newResponse()
        out['data'] = jo
        return out

    def handleWebsocket(self, cmd, params):
        peerid = params['peer']
        bot = params['bot']
        conid = int(params['stream'])
        p = self.P2P.getPeer(id, False)
        sock = p.getStream(conid)
        b = self.getBot(bot)
        b.webSocketConnect(sock, cmd)
        return "OK"

    def handleStream(self, params):
        id = params['peer']
        peer = self.P2P.getPeer(id, False)
        stream = int(params['stream'])
        connect = params['connect'] == 'true'
        if (connect):
            con = P2PStream(peer, stream)
            peer.accept(con)
        else:
            peer.remove(stream)
        return "OK"

    def handleLocal(self, params):
        # FIXME - thread and return None like remote

        uuid = params['peer']
        p = self.P2P.getPeer(uuid, False)
        id = int(params['stream'])
        print('Handling request local via stream '+str(id))
        oscon = p.getStream(id)

        u = params['url']
        o = json.loads(params['params'])
        sid = params['sessionid']

        if 'FILEUPDLOAD' in o:
            fu = o['FILEUPDLOAD']
            if '\\' in fu: fu = fu[fu.rindex('\\')+1:]
            if '/' in fu: fu = fu[fu.rindex('/')+1:]
            fu = self.getUploadedFile(sid, fu)
            o['FILEUPDLOAD'] = fu

        params = {}
        for key in o:
            params[key] = str(o[key])

        # FIXME - add backward compatibility for no 'request_headers'?

        headers = json.loads(o['request_headers'])
        method = headers['METHOD']
        params['request_socket'] = oscon

        http = self.master.http
        parser = http.newParser()
        parser.init(http, oscon)
        request = HTTPRequest('p2p', method, cmd, headers, params, u)
        response = http.handleCommand(method, headers, params, u, parser, request)
        rh2 = response.head[response.head.index('\r\n')]
        response.head = b''

        def cb():
            response.send(oscon)
            print('P2P send local '+u)
        self.addJob(cb, 'P2P send local '+u)

        jo = self.newResponse()
        jo['msg'] = str(response.len)
        jo['R-HEAD'] = rh2

        return jo

    def getUploadedFile(self, sid, fu):
        p = {
            'id': fu
        }
        # FIXME - implement double-blind sessionid for p2p connections
        o = self.sendCommand(sid, 'peerbot', 'tempfile', p)
        stream = o['stream']
        llen = o['len']
        iscon = self.P2P.getPeer(sid).getStream(stream)
        f = self.newTempFile()
        self.writeFile(f, iscon)
        iscon.close()
        return f

    def sendCommandAsync(self, id, bot, cmd, params, cb):
        peer = self.getPeer(id, True)
        cmd = P2PCommand(bot, cmd, params, cb)
        peer.sendCommandAsync(cmd)

    def getPeer(self, id, create=True):
        return self.P2P.getPeer(id, create)

    def handleRemote(self, cmd, params):
        i = cmd.index('/')
        peer = cmd[:i]
        cmd = cmd[i+1:]
        p = self.P2P.getPeer(peer, False)
        if p == None: raise Exception('Unknown peer: '+peer)
        # FIXME - add postpone and connect on not connected

        oscon = params['request_socket']
        iscon = p.newStream()

        o = json.dumps(params)
        params = {
            'url': cmd,
            'peer': self.P2P.getLocalID(),
            'stream': con.id,
            'params': o
        }
        def cb(o):
            if not o['status'] == 'ok':
                print('FIXME') # FIXME
            else:
                len1 = int(o['msg'])
                m = self.getMIMEType(cmd)
                if m == None: m = 'text/plain'
                headers = o['R-HEAD']
                if 'Set-Cookie' in headers:
                    # FIXME - probably shouldn't filter out ALL cookies just sessionid. Also, fix sessionid for p2p as double-blind
                    i = headers.index('Set-Cookie')
                    headers = headers[:i]+'Do-Not-'+headers[i:]
                res = "200 OK"
                if '\r\nContent-Range: ' in headers: res = '206 Partial Content'
                head = "HTTP/1.1 " + res + headers + "\r\n\r\n"
                HTTPResponse(head.encode(), iscon, len1).sendAll(oscon)
                iscon.close()

        self.sendCommandAsync(peer, 'peerbot', 'local', params, cb)

        #FIXME - implement handling of None response means release custody of socket
        return None

    def handleDisconnect(self, params):
        uuid = params['uuid']
        self.P2P.disconnect(uuid)
        return 'OK'

    def handleConnect(self, params):
        uuid = params['uuid']

        code = None
        groups = None
        address = None
        port = -1

        if 'code' in params: code = params['code']
        if 'groups' in params: groups = params['groups']
        if 'address' in params:
            address = params['addr']
            port = int(params['port'])

        p = self.connect(uuid, address, port)
        p.code = code

        if not groups == None:
            self.setGroups(uuid, groups)

        if not code == None:
            def cb():
                d = {
                    'uuid': uuid,
                    'code': code
                }
                print('Sending access code to '+p.name+'/'+p.id)
                jo = p.sendCommand('peerbot', 'accesscode', d)
                print('Sent access code to '+p.name+'/'+p.id+': '+json.dumps(jo))
            self.addJob(cb, 'Send access code to '+p.name+'/'+p.id)

        return 'OK'

    def connect(self, uuid, addr = None, port = -1):
        peer = self.P2P.connect(uuid, addr, port)
        if peer == None:
            # FIXME - is this even possible?
            raise Exception("Unable to connect to peer (timeout)")
        return peer

    def setGroups(self, uuid, groups):
        d = {
            'username': uuid,
            'groups': groups
        }
        self.getBot('securitybot').handleCommand('newuser', d)

    def handleConnectionStatus(self, params):
        uuid = params['uuid']
        if uuid in self.P2P.peers.peers:
            if self.P2P.peers.peers['uuid'].isConnected(): return 'OK'
        return 'NOT CONNECTED'

    def handleGetMachineID(self, params):
        return self.getMachineID()

    def handleGetPeerID(self, params):
        return self.getLocalID()

    def handleListZeroConf(self, params):
        return self.master.handleCommand('discover', params)

    def handleNOOP(self, params):
        return 'OK'

    def handleRegister(self, params):  # SEE PeerBot.handleToggleKeepalive
        id = params['uuid']
        p = self.P2P.getPeer(id, True)
        b = False

        if 'name' in params:
            name = params['name']
            if not name == p.name:
                p.name = name
                b = True

        ip = params['local']
        port = params['port']
        pt = int(port)
        p.addSocketAddress(ip, pt)

        if 'addresses' in params:
            addresses = params['addresses']
            list = addresses.split(',')
            for addr in list:
                p.addSocketAddress(addr, pt)

        if p.pub == None:
            jo = p.sendCommand('peerbot', 'pubkey', {})
            if jo['status'] == 'ok':
                ba = self.fromHexString(jo['msg'])
                p.pub = ba
                b = True

        if b:
            self.p2p.peers.savePeer(p)
            self.fireEvent("update", p.toDict())

        jo = self.newResponse()
        jo['name'] = self.getMachineID()
        return jo

    def handleLookUp(self, params):
        if 'uuid' in params:
            id = params['uuid']
            if id in self.P2P.peers.peers:
                p = self.P2P.peers.peers[id]
                o = p.toDict()
                a = o['addresses']
                addresses = ''
                for addr in a:
                    if not addresses == '': addresses += ','
                    addresses += addr[:addr.rindex(':')]
                o['addresses'] = addresses
                o['status'] = 'ok'
                o['msg'] = 'OK'
                return o
            else: raise exception("Do not know "+id)
        else:
            o = {}
            o['status'] = 'ok'
            o['msg'] = 'OK'

            ids = params['uuids'].split(' ')
            for id in ids:
                if id in self.P2P.peers.peers:
                    try:
                        params['uuid'] = id
                        o[id] = self.handleLookUp(params)
                    except Exception as e:
                        self.printStackTrace(e)
            return o

    # FIXME - Remove unnecessary attributes
    def handleGetPeerInfo(self, params):
        o = {
            "id": self.getLocalID(),
            "name": self.properties['machineid'],
            "connected": True,
            "addr": self.P2P.getLocalAddress(),
            "localip": self.P2P.getLocalAddress(),
            "port": self.P2P.getLocalPort(),
            "keepalive": True,
            "localid": -1,
            "remoteid": -1
        }
        return o

    def handleConnections(self, params):
        d = {}
        jo = self.newResponse()
        jo['data'] = d
        for uuid in self.P2P.peers.peers:
            d[uuid] = self.P2P.peers.peers[uuid].toDict()
            print(self.P2P.isTCP(uuid))
        return jo

    def hasPeer(self, id):
        return self.P2P.hasPeer(id)

    def getLocalID(self):
        return self.properties['uuid']

    commands = {
        "deleteaccesscode":{
            "parameters":[
                "code"
            ],
            "desc":"Delete an existing access code."
        },
        "disconnect":{
            "parameters":[
                "uuid"
            ],
            "desc":"Disconnect from a remote device."
        },
        "setpubkey":{
            "parameters":[
                "uuid",
                "pub"
            ],
            "desc":"Set the public key for the given peer."
        },
        "brokers":{
            "parameters":[
                "brokers"
            ],
            "desc":"Get/set the list of connection brokers"
        },
        "newconnection":{
            "parameters":[
                "uuid",
                "addr",
                "port",
                "code",
                "groups"
            ],
            "desc":"Connect to a remote device. Optionally, you may pass a suggested IP Address and port number. You can also specify an access code and/or the groups you want to assign the device to. All parameters other than uuid are optional."
        },
        "available":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "uuid"
            ],
            "desc":"Returns an error if the given peer is not responding."
        },
        "getpeerinfo":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "desc":"Returns the connection information about this device."
        },
        "remote":{
            "include":[
                "trusted"
            ],
            "groups":"trusted",
            "exclude":[

            ],
            "desc":"Send a command or http request to a remote device.<br><b>Usage:<\/b> http://localhost:5773/peerbot/remote/remote-universal-id/botname/cmd?param1=val1&param2=val2"
        },
        "setreadkey":{
            "parameters":[
                "uuid",
                "key"
            ],
            "desc":"Set the read key for the given peer."
        },
        "local":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "desc":"Execute a command or http request on the local device. Used internally by the remote command."
        },
        "noop":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "desc":"Do nothing."
        },
        "stream":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "peer",
                "stream",
                "connect"
            ],
            "desc":"Accepts a bidirectional data stream request with the remote device if connect=true, otherwise disconnects the specified stream."
        },
        "websocket":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "peer",
                "bot",
                "stream"
            ],
            "desc":"Open a websocket connection on the remote device and attach it to the given stream."
        },
        "getpeerid":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "desc":"Returns the universal ID of this device."
        },
        "listzeroconf":{
            "desc":"Deprecated. Do not use. Use botmanager/discover instead."
        },
        "connect":{
            "parameters":[
                "uuid",
                "addr",
                "port",
                "code",
                "groups"
            ],
            "desc":"Connect to a remote device. Optionally, you may pass a suggested IP Address and port number. You can also specify an access code and/or the groups you want to assign the device to. All parameters other than uuid are optional."
        },
        "connections":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "desc":"List all of the devices the local device knows how to connect to."
        },
        "getmachineid":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "desc":"Returns the name of this device."
        },
        "lookup":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "uuid"
            ],
            "desc":"Returns the connection information for a specific device."
        },
        "accesscode":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "uuid",
                "code"
            ],
            "desc":"Grant the permissions defined by the given access code to the given peer."
        },
        "subscribe":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "bot",
                "channel",
                "sessionid"
            ],
            "desc":"Add the requesting peer to the websocket subscriptions for the given bot and channel."
        },
        "addaccesscode":{
            "parameters":[
                "code",
                "groups",
                "delete"
            ],
            "desc":"Define a new access code. Access code will be single-use if delete=true."
        },
        "allowanon":{
            "parameters":[
                "allow"
            ],
            "desc":"Allow or disallow anonymous incoming peer connection requests."
        },
        "tempfile":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "id",
                "sessionid"
            ],
            "desc":"Send the temporary file with the given ID to the requesting peer via a new stream. Returns the new stream ID."
        },
        "accesscodes":{
            "desc":"List all access codes for connecting to this device."
        },
        "connectionstatus":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "uuid"
            ],
            "desc":"Returns the connection status of the remote device."
        },
        "deletepeer":{
            "parameters":[
                "uuid"
            ],
            "desc":"Delete an existing peer connection."
        },
        "register":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "uuid",
                "local",
                "addresses",
                "port",
                "name"
            ],
            "desc":"Send information on how to locate yourself to another peer."
        },
        "togglekeepalive":{
            "parameters":[
                "uuid",
                "keepalive"
            ],
            "desc":"Specify whether or not this device should attempt to remain connected to the given peer."
        },
        "pubkey":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "uuid"
            ],
            "desc":"Returns the public key for the given peer."
        }
    }
