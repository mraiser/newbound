import sys
import threading
import traceback

class CommandThread(threading.Thread):
	def __init__(self, handler):
		threading.Thread.__init__(self)
		self.handler = handler
		self.onDuty = False
		self.working = False
		
	def isOnDuty(self):
		return self.onDuty
		
	def putOnDuty(self):
		self.onDuty = True
		
	def takeOffDuty(self):
		self.onDuty = False
		
	def isWorking(self):
		return self.working
		
	def run(self):
		self.onDuty = True
		while self.onDuty:
			try:
				self.setName('No work')
				queue = self.handler.queue
				job = queue.getSomeWork()
				if (job != None):
					self.setName(job.toString())
					self.working = True
					job.run()
					self.working = False
			except Exception as e:
				print('Threaded job terminated unexpectedly with exception: '+str(e))
				traceback.print_exc(file=sys.stdout)
		self.handler.bye(self)