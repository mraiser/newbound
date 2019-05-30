import json

class P2PCommand(object):
    def __init__(self, bot, cmd, params={}, cb=None):
        self.id = -1
        self.bot = bot
        self.cmd = cmd
        self.params = params
        self.cb = cb

    def toDict(self):
        d = {
            'id': self.id,
            'bot': self.bot,
            'cmd': self.cmd,
            'params': self.params
        }
        return d

    def toString(self):
        return json.dumps(self.toDict())

    def toBytes(self):
        return self.toString().encode()
