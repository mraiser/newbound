class COMMAND(object):
	def __init__(self, service):
		self.service = service
		
	def execute(self, data):
		
		def doit():
			uuid = data['uuid']
			ba = data['data']
			sock = data['p2psocket']
			if self.service.p2p.isOK(uuid, sock, self.execute, data):
				p = self.service.p2p.getPeer(uuid)
				p.setConnected(True)
				ba = p.decrypt(ba)
				try:
					p.command(ba)
				except Exception as e:
					print('Error executing p2p command '+str(e))
					self.service.p2p.printStackTrace(e)
		
		self.service.p2p.addJob(doit, 'Executing P2P command')