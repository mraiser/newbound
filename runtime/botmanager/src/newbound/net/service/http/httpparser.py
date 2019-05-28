from newbound.net.service.http.httprequest import HTTPRequest
from newbound.net.service.http.httpresponse import HTTPResponse
from newbound.robot.botutil import BotUtil

class HTTPParser(BotUtil):

	def init(self, server, sock):
		self.server = server
		self.sock = sock
		return True
		
	def close(self):
		self.sock.close()
		
	def execute(self, data, callback):
		callback(data.getData())
		
	def parse(self):
		oneline = self.sock.readLine()
		if oneline == None:
			return None
		
		sa = oneline.split(' ')
		method = sa[0].upper()
		cmd = sa[1]
		protocol = sa[2]
		querystring = ''

		headers = self.parseHeaders()
		
		params = {}
		if method == 'POST': extractPOSTparams(params, headers)
		
		if '?' in cmd:
			i = cmd.index('?')
			querystring = cmd[i+1:]
			cmd = cmd[:i]
			self.addParams(params, querystring)
		
		loc = '/'+self.sock.getRemoteAddress()+':'+str(self.sock.getRemotePort())
		return HTTPRequest(protocol, method, cmd, headers, params, loc)
		
	def addParams(self, params, oneline):
		try:
			lines = oneline.split('&')
			for line in lines:
				try:
					keypair = line.split('=')
					params[keypair[0]] = self.hexDecode(keypair[1])
				except Exception as e:
					print("Error parsing query string parameter: "+line+"/"+str(e))
		except:
			print("Error parsing query string parameters: "+oneline)
		return params
		
	def parseHeaders(self):
		last = None
		headers = {}
		
		while True:
			oneline = self.sock.readLine()
			if oneline == "": break
			i = oneline.index(':')
			key = oneline[0:i].upper()
			val = oneline[i+1:].strip()
			headers[key] = val
		
		return headers	
		
	def error(self, cmd, request, code, msg):
		# FIXME - add 404 page from file
		code = str(code)

		body = "<html><head><title>"+code+" "+msg+"</title></head><body><h1>"
		body += code
		body += "</h1>"
		body += msg
		body += "</body></html>";

		l = len(body)
		head = "HTTP/1.1 "+code+" "+msg+"\r\nContent-Length: "+str(l)+"\r\nContent-Type: text/html\r\n\r\n"
		return HTTPResponse(head.encode(), body.encode(), len(body))
		
	def send(self, response):
		response.send(self.sock)
		
		