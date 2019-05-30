from newbound.robot.botutil import BotUtil

class HTTPRequest(BotUtil):

    def __init__(self, protocol, method, cmd, headers, params, loc):
        self.protocol = protocol
        self.method = method
        self.cmd = cmd
        self.headers = headers
        self.params = params
        self.loc = loc

        log = {}
        self.log = log

        now = self.currentTimeMillis()

        log['timestamp'] = now
        log['method'] = method
        log['path'] = cmd
        log['protocol'] = protocol

        language = '*'
        if "ACCEPT-LANGUAGE" in headers:
            language = headers["ACCEPT-LANGUAGE"]
        log['language'] = language

        sid = ''
        if "COOKIE" in headers:
            c = headers['COOKIE']
            cs = c.split("; ")
            for line in cs:
                if line.startswith("sessionid="):
                    sid = line[10:]
                    headers['nn-sessionid'] = sid
                    break
        log['sessionid'] = sid

        host = ''
        if 'HOST' in headers:
            host = headers['HOST']
        log['HOST'] = host

        r = ''
        if 'REFERER' in headers:
            r = headers['REFERER']
        log['REFERER'] = r

        headers['nn-log'] = log

    def getCommand(self):
        return self.cmd

    def getData(self):
        d = {
            'cmd': self.cmd,
            'loc': self.loc,
            'method': self.method,
            'headers': self.headers,
            'log': self.log
        }
        return d
	
	
	
	