import traceback
import sys
from newbound.robot.botutil import BotUtil
from .surrendersocketexception import SurrenderSocketException

class Service(BotUtil):

    def __init__(self, serversocket, name, parser, container):
        self.serversocket = serversocket
        self.name = name
        self.parser = parser
        self.container = container
        self.running = False
        self.callbacks = {}
        container.addNumThreads(1)
        container.addJob(self.serviceloop, "Service "+self.name+" listening on port "+str(serversocket.getPort()))
        print("Service "+self.name+" started on port "+str(serversocket.getPort()))

    def serviceloop(self):
        self.running = True
        print("Service "+self.name+" starting up...")
        while self.running:
            try:
                self.accept()
            except Exception as e:
                print("Unexpected error listening for "+self.name+" connections "+str(e))
                traceback.print_exc(file=sys.stdout)

    def accept(self):
        s = self.serversocket.accept()
        p = self.parser()
        if p.init(self, s):
            self.listen(s, p)

    def socketloop(self, s, p):
        while (self.running and s.isConnected()):
            try:
                r = p.parse()
                if r == None:
                    s.close()
                else:
                    try:
                        cmd = r.getCommand()
                        self.execute(cmd, r, p)
                    except SurrenderSocketException:
                        break
                    except Exception as e:
                        print("Unexpected error parsing " + self.name + " command " + str(e))
                        traceback.print_exc(file=sys.stdout)
            except Exception as e:
                print("Unexpected error parsing " + self.name + " command " + str(e))
                traceback.print_exc(file=sys.stdout)
                s.close()

    def listen(self, s, p):
        def cb():
            self.socketloop(s, p)
        self.container.addJob(cb, "Socket "+self.name)

    def on(self, cmd, callback):
        self.callbacks[cmd] = callback

    def execute(self, cmd, request, parser):
        if cmd in self.callbacks:
            parser.execute(request, self.callbacks[cmd])
        else:
            print("Ignoring unknown command "+str(cmd)+" / "+str(request.getData()))
        #parser.send(parser.error(cmd, request, 404, "File not found"))

    def close(self):
        self.running = False
        self.serversocket.close()

    def getAddress(self):
        return self.serversocket.getAddress()

    def getPort(self):
        return self.serversocket.getPort()
		