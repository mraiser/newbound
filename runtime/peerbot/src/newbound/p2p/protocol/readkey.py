from newbound.crypto.supersimplecipher import SuperSimpleCipher

class READKEY(object):
	def __init__(self, service):
		self.service = service
		
	def execute(self, data):
		uuid = data['uuid']
		ba = data['data']
		sock = data['p2psocket']
		p = self.service.p2p.getPeer(uuid)
		if p.readkey == None:
			print("Got read key for "+uuid)
			ba = self.service.p2p.decryptWithPrivateKey(uuid, ba)
			p.readkey = SuperSimpleCipher(ba)
			if p.port == -1 or p.port == 0: p.port = sock.parser.remoteport
			self.service.p2p.peers.savePeer(p)
		else:
			print("Got read key for "+uuid+", but we already have one. Ignoring.")
		sock.connecting = False
		self.service.p2p.isOK(uuid, sock, None, None)