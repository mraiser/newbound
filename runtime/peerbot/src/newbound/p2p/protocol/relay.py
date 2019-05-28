class RELAY(object):
	def __init__(self, service):
		self.service = service
		
	def execute(self, data):
		uuid = data['uuid']
		ba = data['data']
		uuid2 = ba[:36].decode()
		ba = uuid.encode()+ba[36:]
		sock = data['p2psocket']
		p2p = sock.service.p2p
		if not p2p.sendTCP(uuid2, ba, Codes.RELAYED):
			p2p.sendTCP(uuid, uuid2.encode(), Codes.NORELAY)