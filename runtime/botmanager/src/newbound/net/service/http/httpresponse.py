from newbound.robot.botutil import BotUtil

class HTTPResponse(BotUtil):

	def __init__(self, head, body, l):
		self.head = head
		self.body = body
		self.len = l
		
	def send(self, out):
		out.sendall(self.head)
		t = type(self.body).__name__
		if t == 'BufferedReader':
			self.sendData(self.body, out, self.len, 1024)
		else:
			out.sendall(self.body)
