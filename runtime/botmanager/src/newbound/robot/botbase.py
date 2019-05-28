import os
import sys
import platform
import webbrowser
import json
import math
import traceback
from .botutil import BotUtil
from newbound.thread.threadhandler import ThreadHandler
from newbound.net.service.http.httpservice import HTTPService

class BotBase(BotUtil):

	sessiontimeout = 900000 # 15 minutes
	sessioncheckinterval = 10000 # 10 seconds
	
	def start(self, root, launchbrowser=False):
		print('Starting up '+self.getServiceName()+'...')
		self.sessions = {}
		self.off = False
		self.running = True
		
		self.init(root)
		
		self.threadhandler.addNumThreads(10)
		self.http = HTTPService(self, self.getPortNum())
		if launchbrowser: webbrowser.open('http://localhost:'+str(self.getPortNum())+'/'+self.getServiceName()+'/'+self.getIndexFileName())
		#FIXME - add session timeout checking
		print('Startup complete.')
			
	def init(self, root, master=None):
		print('Initializing '+self.getServiceName()+'...')
		self.root = root;
		self.websockets = []
		
		if master == None: 
			self.master = self
		else: 
			self.master = master
			self.sessions = master.sessions
			
		if not os.path.exists(root): os.makedirs(root)
		self.threadhandler = ThreadHandler(self.getServiceName())
		self.threadhandler.init()
		
		f = os.path.join(root, 'app.properties');
		if os.path.exists(f):
			self.appproperties = self.load_properties(f);
		else:
			claz = type(self).__module__+'.'+type(self).__name__
			self.appproperties = {
				"id": self.getServiceName(),
				"name": self.getServiceName(),
				"desc": "The "+self.getServiceName()+" application",
				"img": "/botmanager/img/nslcms.png",
				"botclass": claz,
				"price": "0.00",
				"version": "1"
			}
			self.save_properties(self.appproperties,f);
		
		f = os.path.join(root, 'botd.properties');
		if os.path.exists(f):
			self.properties = self.load_properties(f);
		else:
			self.properties = {}
		
		dirty = False;
		if 'machineid' not in self.properties:
			self.properties['machineid'] = platform.node()
			dirty = True
		if 'portnum' not in self.properties:
			self.properties['portnum'] = self.getDefaultPortNum()
			dirty = True
		if dirty:
			self.save_properties(self.properties,f);
	
	def initializationComplete(self):
		self.threadhandler.addNumThreads(5)
		print(self.getServiceName()+' ready.')
			
	def getDefault(self):
		return self
		
	def handles(self, cmd):
		while cmd.startswith('/'): cmd = cmd[1:]
		if not '/' in cmd: return False
		i = cmd.index('/')
		bot = cmd[:i]
		cmd = cmd[i+1:]
		b = self.getBot(bot)
		if b == None: return False
		return b.hasCommand(cmd)
		
	def handle(self, method, headers, params, cmd, parser, request):
		while cmd.startswith('/'): cmd = cmd[1:]
		i = cmd.index('/')
		bot = cmd[:i]
		cmd = cmd[i+1:]
		b = self.getBot(bot)
		out = b.handleCommandRequest(method, headers, params, cmd, parser, request)
		l = -1
		
		return self.transformResult(out, l, cmd)
		
	def transformResult(self, out, l, cmd):	
		# FIXME add file, stream, number
		t = type(out).__name__
		if t == 'str': 
			d = {
				"status": "ok",
				"msg": out
			}
			cmd += ".json"
			out = json.dumps(d)
			l = len(out)
			out = out.encode()
		elif t == 'dict':
			cmd += ".json"
			out = json.dumps(out)
			l = len(out)
			out = out.encode()
		elif t == 'list': 
			d = {
				"status": "ok",
				"list": out
			}
			cmd += ".json"
			out = json.dumps(d)
			l = len(out)
			out = out.encode()
		return out, l, cmd
		
	def getLocalID(self):
		b = self.getBot('peerbot')
		return b.getLocalID()		
		
	def getMachineID(self):
		b = self.master
		return b.getMachineID()		
		
	def validateRequest(self, bot, cmd, params):
		b = self.getBot('securitybot')
		b.validateRequest(bot, cmd, params)
		
	def updateSessionTimeout(self, s):
		s['expire'] = self.currentTimeMillis() + self.sessiontimeout
		
	def handleCommandRequest(self, method, headers, params, cmd, parser, request):
		try:
			self.validateRequest(self, cmd, params)
			return self.handleCommand(cmd, params)
		except Exception as e:
			o = {
				'status': 'err',
				'msg': str(e)
			}
			if 'includeerrinfo' in params: o['errinfo'] = traceback.format_exc()
			return o
			
	def sendCommandAsync(self, peer, bot, cmd, params, cb):
		b = self.getBot('peerbot')
		b.sendCommandAsync(peer, bot, cmd, params, cb)
				
	def handleWebSocket(self, cmd, sock):
		while cmd.startswith('/'): cmd = cmd[1:]
		i = cmd.index('/')
		bot = cmd[:i]
		cmd = cmd[i+1:]
		b = self.getBot(bot)
		b.webSocketConnect(sock, cmd)
		
	def webSocketConnect(self, sock, cmd):
		#print('Starting websocket for '+self.getServiceName())
		self.websockets.append(sock)
		pow7 = int(math.pow(2, 7))
		baos = b''
		while (sock.isConnected()):
			ia = sock.read(1)
			if len(ia) == 0: break
			i = ia[0]
			fin = (pow7 & i) != 0
			rsv1 = (int(math.pow(2, 6)) & i) != 0;
			rsv2 = (int(math.pow(2, 5)) & i) != 0;
			rsv3 = (int(math.pow(2, 4)) & i) != 0;
			
			if rsv1 or rsv2 or rsv3: 
				self.websocketFail(sock)
				break
			else:
				opcode = 0xf & i
				i = sock.read(1)[0]
				mask = (pow7 & i) != 0
				if not mask: 
					self.websocketFail(sock)
					break
				else:
					l = i - pow7
					if l == 126:
						l = (sock.read(1)[0] & 0x000000FF) << 8
						l += (sock.read(1)[0] & 0x000000FF)
					elif l == 127:
						l = (sock.read(1)[0] & 0x000000FF) << 56
						l += (sock.read(1)[0] & 0x000000FF) << 48
						l += (sock.read(1)[0] & 0x000000FF) << 40
						l += (sock.read(1)[0] & 0x000000FF) << 32
						l += (sock.read(1)[0] & 0x000000FF) << 24
						l += (sock.read(1)[0] & 0x000000FF) << 16
						l += (sock.read(1)[0] & 0x000000FF) << 8
						l += (sock.read(1)[0] & 0x000000FF)
					maskkey = sock.read(4)
					off = 0
					buffer = bytearray(b'')
					while off < l:
						mmax = min(4096, l-off)
						buffer = bytearray(sock.read(mmax))
						n = len(buffer)
						if (n == 0): break
						i = n
						while i>0:
							i -= 1
							buffer[i] = buffer[i] ^ maskkey[i % 4]
						off += n
						baos += bytes(buffer)
					if off<l:
						self.websocketFail(sock)
						break
					
					if opcode == 0:
						print('WEBSOCKET continuation frame for '+self.getServiceName())
					elif opcode == 8:
						#print('WEBSOCKET connection close for '+self.getServiceName())
						self.websocketClose(sock)
					elif opcode == 9:
						print('WEBSOCKET ping for '+self.getServiceName())
					elif opcode == 10:
						print('WEBSOCKET pong for '+self.getServiceName())
					
					if fin:
						msg = baos
						baos = b''
					
						if opcode == 1: self.webSocketMessageText(sock, msg.decode())
						elif opcode == 2: self.webSocketMessageBinary(sock, msg)
		if sock in self.websockets: 
			print('END WEBSOCKET LOOP')
			self.websockets.remove(sock)
	
	def webSocketMessageText(self, sock, msg):
		print('WEBSOCK '+self.getServiceName()+' '+msg)
		if msg.startswith('cmd '):
			try:
				jo = json.loads(msg[4:])
				
				peer = None
				if 'peer' in jo: peer = jo['peer']
				bot = self.getBot(jo['bot'])
				cmda = jo['cmd']
				pid = jo['pid']
				params = jo['params']

				if peer != None:
					def cb(jo2):
						jo2['pid'] = pid
						self.sendWebSocketMessageText(sock, json.dumps(jo2))
					self.sendCommandAsync(peer, jo['bot'], cmda, params, cb)
				else:
					def execnow():
						out = None
						try:
							self.validateRequest(self, cmda, params)
							out = bot.handleCommand(cmda, params)
						except Exception as e:
							out = {
								'status': 'err',
								'msg': str(e)
							}
							if 'includeerrinfo' in params: out['errinfo'] = traceback.format_exc()
						
						t = type(out).__name__
						if t != 'dict': 
							out = {
								"status": "ok",
								"msg": out
							}
						out['pid'] = pid
											
						self.sendWebSocketMessageText(sock, json.dumps(out))
					bot.addJob(execnow)
					
			except Exception as e:
				print("WEBSOCKET ERROR: "+str(e))		
				print(msg)		
				traceback.print_exc(file=sys.stdout)
				
	def webSocketMessageBinary(self, sock, msg):
		print("BINARY WEBSOCKET MSG: "+msg.decode())
	
	def sendWebSocketMessageText(self, sock, msg):
		self.sendWebSocketMessage(sock, msg.encode(), False)
		
	def sendWebSocketMessage(self, sock, msg, isbytes):
		reply = b''
		
		t = 129
		if isbytes: t += 1
		reply += bytes([t])

		n = len(msg)
		if n < 126:
			reply += bytes([n])
		elif n < 65536:
			reply += bytes([126])
			reply += bytes([(n >> 8) & 0xFF])
			reply += bytes([n & 0xFF])
		else:
			reply += bytes([127])
			reply += bytes([(n >> 56) & 0xFF])
			reply += bytes([(n >> 48) & 0xFF])
			reply += bytes([(n >> 40) & 0xFF])
			reply += bytes([(n >> 32) & 0xFF])
			reply += bytes([(n >> 24) & 0xFF])
			reply += bytes([(n >> 16) & 0xFF])
			reply += bytes([(n >> 8) & 0xFF])
			reply += bytes([n & 0xFF])
		reply += msg
		sock.sendall(reply)
	
	def websocketFail(self, sock):
		print('websocketFail')
		self.websocketClose(sock)
		
	def websocketClose(self, sock):
		#print('websocketClose')
		if sock.isConnected(): sock.close()
		if sock in self.websockets: 
			self.websockets.remove(sock)
		
	def getBot(self, bot):
		if bot == self.getServiceName(): return self
		if self.master != self: return self.master.getBot(bot)
		return None

	def getRootDir(self):
		return self.root
	
	def getDefaultPortNum(self):
		return 5773
		
	def getPortNum(self):
		if 'portnum' in self.properties: return int(self.properties['portnum'])
		else: return self.getDefaultPortNum()
		
	def addJob(self, runnable, name="UNTITLED"):
		self.threadhandler.addJob(runnable, name)
		
	def addNumThreads(self, num):
		self.threadhandler.addNumThreads(num)
		
	def addPeriodicTask(self, pt, millis=None, name="UNTITLED PERIODIC TASK", isrun=None, repeat=True):
		self.threadhandler.addPeriodicTask(pt, millis, name, isrun, repeat)
		
	def fireEvent(self, eventname, data):
		#print('EVENT: '+eventname+str(data))
		x = 1
		
	def getSession(self, sid, create=False):
		expire = self.currentTimeMillis() + self.sessiontimeout
		if sid in self.sessions:
			s = self.sessions[sid]
			s['expire'] = expire
			return s
		else:
			if create:
				s = {
					"expire": expire
				}
				self.sessions[sid] = s
				return s
			else:
				return None
				
	def getSessionByUsername(self, username):
		for sid in self.sessions:
			ses = self.sessions[sid]
			if 'username' in ses and ses['username'] == username:
				return ses
		return None
	
	def extractLocalFile(self, path):
		while path.startswith('/'): path = path[1:]
		home = self.getParentFile(self.root)
		home = self.getParentFile(home)
		home = os.path.join(home, 'html')
		f = os.path.join(home, path)
		if os.path.isdir(f): f = os.path.join(f, self.getIndexFileName())
		if not os.path.exists(f):
			bot = path
			cmd = ''
			if '/' in path:
				i = path.index('/')
				bot = path[:i]
				cmd = path[i+1:]
			b = self.getBot(bot)
			if not b == None:
				botroot = b.getRootDir()
				home = os.path.join(botroot, 'html')
				f = os.path.join(home, cmd)
				if os.path.isdir(f): f = os.path.join(f, b.getIndexFileName())
				if not os.path.exists(f):
					home = os.path.join(botroot, 'src')
					home = os.path.join(home, 'html')
					home = os.path.join(home, b.getServiceName())
					f = os.path.join(home, cmd)
					if os.path.isdir(f): f = os.path.join(f, b.getIndexFileName())
		return f
		
	def newResponse(self):
		d = {
			"status": "ok",
			"msg": "OK"
		}
		return d	
		
	def getIndexFileName(self):
		return "index.html"
		
	def saveSettings(self):
		f = os.path.join(self.root, 'botd.properties');
		self.save_properties(self.properties,f);
		
	def getData(self, db, id):
		return self.master.getData(db, id)

	def setData(self, db, id, data, readers, writers, sessionid=None):
		return self.master.setData(db, id, data, readers, writers, sessionid)
				
	def hasCommand(self, cmd):
		if '/' in cmd: cmd = cmd[0:cmd.index('/')]
		return cmd in self.getCommands()
	
	def getCommands(self):
		return self.commands

	commands = {}