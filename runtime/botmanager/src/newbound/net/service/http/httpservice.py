import os
import json
import hashlib
import base64
from newbound.net.service.service import Service
from newbound.net.service.surrendersocketexception import SurrenderSocketException
from newbound.net.service.http.httpparser import HTTPParser
from newbound.net.service.http.httpresponse import HTTPResponse
from newbound.net.tcp.tcpserversocket import TCPServerSocket

class HTTPService(Service):

    filesystem_ttl = 3600000

    def __init__(self, bot, port):
        Service.__init__(self, TCPServerSocket(port), "HTTP", self.newParser, bot)
        self.bot = bot
        self.port = port

    def newParser(self):
        return HTTPParser()

    def execute(self, cmd, request, parser):
        if cmd in self.callbacks:
            parser.execute(request, self.callbacks[cmd])
        else:
            headers = request.headers
            params = request.params
            log = request.log
            loc = request.loc
            self.container.fireEvent("HTTP_BEGIN", log)

            now = self.currentTimeMillis();

            sid = None
            if 'sessionid' in params: sid = params['sessionid']
            else:
                if 'nn-sessionid' in headers: sid = headers['nn-sessionid']
                else:
                    sid = self.uniqueSessionID()
            headers['nn-sessionid'] = sid
            session = self.container.getSession(sid, True)
            session["userlocation"] = loc
            headers['nn-userlocation'] = loc
            params['sessionid'] = sid
            params['sessionlocation'] = loc
            params['request_headers'] = json.dumps(headers)
            params['request_socket'] = parser.sock

            if 'user' in session:
                headers['nn-username'] = session['username']
                user = session['user']
                if 'groups' in user:
                    headers['nn-groups'] = user['groups']
                else:
                    headers['nn-groups'] = 'anonymous'
            else:
                headers['nn-username'] = 'anonymous'
                headers['nn-groups'] = 'anonymous'

            if 'SEC-WEBSOCKET-KEY' in headers:
                self.switchToWebSocket(headers['SEC-WEBSOCKET-KEY'], cmd, parser)
            else:
                ka = None
                if 'CONNECTION' in headers: ka = headers['CONNECTION']

                response = self.handleCommand(request.method, headers, params, cmd, parser, request)
                if response is None:
                    raise SurrenderSocketException()
                response.keepalive = response.len != -1 and ka != None and ka == 'keep-alive'
                parser.send(response)
                if not response.keepalive: parser.close()

                log['millis'] = self.currentTimeMillis() - now
                # FIXME - make sure all of these are set in all scenarios
                if 'nn-request-type' in headers:
                    log['request-type'] = headers['nn-request-type']
                if 'nn-response-type' in headers:
                    log['response-type'] = headers['nn-response-type']
                if 'nn-extension' in headers:
                    log['extension'] = headers['nn-extension']
                if 'nn-sessionid' in headers:
                    log['response-sessionid'] = headers['nn-sessionid']
                if 'nn-username' in headers:
                    log['user'] = headers['nn-username']
                if 'nn-groups' in headers:
                    log['groups'] = headers['nn-groups']
                if 'nn-userlocation' in headers:
                    log['userlocation'] = headers['nn-userlocation']
                self.container.fireEvent("HTTP_END", log)

    def handleCommand(self, method, headers, params, cmd, parser, request):
        #print('Handling http command: '+cmd)
        #if cmd == '' or (cmd.endswith('/') and len(cmd)>1): cmd += '/'+self.container.getIndexFileName()
        f = self.container.extractLocalFile(cmd)
        if os.path.exists(f):
            rtype = "file"
            headers['nn-request-type'] = rtype
            filename_w_ext = os.path.basename(f)
            filename, file_extension = os.path.splitext(filename_w_ext)
            headers['nn-extension'] = file_extension
            return self.handleFile(f, params, headers)
        else:
            if cmd == '/':
                b = self.container.getDefault()
                nuloc = b.getServiceName()+'/'+b.getIndexFileName()
                return parser.error(cmd, request, 302, 'Found\r\nLocation: '+nuloc)
            elif self.container.handles(cmd):
                try:
                    out, l, name = self.container.handle(method, headers, params, cmd, parser, request)
                    if out == None:
                        return None
                    return self.handleContent(out, params, l, name, headers, 0)
                except Exception as e:
                    self.printStackTrace(e)
                    return parser.error(cmd, request, 500, str(e))

        return parser.error(cmd, request, 404, "File not found")

    def handleFile(self, filename, params, headers):
        f = open(filename,'rb')
        len = os.path.getsize(filename)
        name = os.path.basename(filename)
        # FIXME - reads entire file!
        return self.handleContent(f, params, len, name, headers, self.defaultExpire())

    def defaultExpire(self):
        return self.currentTimeMillis() + self.filesystem_ttl

    def handleContent(self, src, params, len, name, headers, expires):
        #print(expires)
        #print(src)
        #print(params)
        #print(len)
        #print(name)
        #print(headers)
        #print(expires)
        olen = len
        range = self.extractRange(len, headers)
        if not range[1] == -1:
            len = range[1] - range[0] + 1
        s = ''
        if len != -1: s = "\r\nContent-Length: "+str(len)
        if range[0] != -1: s += "\r\nContent-Range: bytes "+str(range[0])+"-"+str(range[1])+"/"+str(olen)
        if expires != -1: s += "\r\nExpires: "+self.toHTTPDate(expires)
        else:
            print('FIXME') #s += "\r\nExpires: 0"
        mimeType = self.getMIMEType(name)
        if mimeType == None: mimeType = 'text/plain'
        #print('MIME TYPE: '+mimeType)
        res = "206 Partial Content"
        if range[0] == -1: res = "200 OK"
        head = "HTTP/1.1 "+res+s+"\r\nAccept-Ranges: bytes\r\nDate: "+self.toHTTPDate(self.currentTimeMillis())+"\r\nContent-type: "+mimeType+"\r\n\r\n"
        # FIXME - does not respect range, will fail
        return HTTPResponse(head.encode(), src, len)

    def extractRange(self, len, headers):
        out = [ -1, -1 ]
        if 'RANGE' in headers:
            r = headers['RANGE']
            sa = r.split('-')
            if not sa[0] == '':
                sa2 = sa[0].split('=')
                out[0] = int(sa2[1])
                if len(sa) > 1 and not sa[1] == '': out[1] = int(sa[1])
                else: out[1] = len-1
            else:
                out[0] = 0
                out[1] = len-1
        return out

    def switchToWebSocket(self, key, cmd, parser):
        key = key.strip()
        key += "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        ink = key
        while len(ink) < 20: ink += ' '
        m = hashlib.sha1()
        m.update(ink.encode())
        d = m.digest()
        key = base64.b64encode(d).decode()
        response = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n";
        response += "Sec-WebSocket-Accept: " + key.strip()+"\r\n";
        response += "Sec-WebSocket-Protocol: newbound\r\n\r\n";
        parser.sock.sendall(response.encode())
        self.container.handleWebSocket(cmd, parser.sock)
		
		
		
		
		
