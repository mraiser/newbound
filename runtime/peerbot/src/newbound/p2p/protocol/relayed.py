from newbound.robot.botbase import BotUtil

class RELAYED(BotUtil):
    def __init__(self, service):
        self.service = service

    def execute(self, data):
        relay = data['uuid']
        ba = data['data']
        target = ba[:36].decode()
        code = self.bytes_to_int(ba[36:40])
        llen = len(ba)-40
        ba2 = self.int_to_bytes(code) + self.int_to_bytes(llen) + ba[40:]
        sock = data['p2psocket']
        sock = self.service.getRelay(target, relay)
        sock.incoming(ba2)
