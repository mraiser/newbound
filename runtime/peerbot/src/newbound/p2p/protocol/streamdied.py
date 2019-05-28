class STREAM_DIED(object):
	def __init__(self, service):
		self.service = service
		
	def execute(self, data):
		uuid = data['uuid']
		ba = data['data']
		p = self.service.p2p.getPeer(uuid)
		ba = p.decrypt(ba)
		p.closeStream(self.bytes_to_long(ba[:4]))