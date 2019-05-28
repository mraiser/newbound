import time
import threading
from .workqueue import WorkQueue
from .commandthread import CommandThread
from .periodictask import PeriodicTask
from newbound.robot.botbase import BotUtil

class ThreadHandler(BotUtil):

	def __init__(self, name):
		self.name = name
		self.threads = []
		self.queue = WorkQueue()
		self.periodic = []
		self.max = 0
		self.ptt = None

	def size(self):
		return len(self.threads)
		
	def available(self):
		n = self.size()
		i = n
		while i>0:
			i -= 1
			if self.threads[i].isWorking(): 
				n -= 1
		return n
		
	def waiting(self):
		return self.queue.size()
	
	def lazyLoad(self):
		if self.size()<self.max:
			if self.available()<=self.waiting():
				self.addThread()
		else: print('No threads currently available for '+self.name+' ('+str(self.waiting())+'/'+str(self.max)+')')
			
	def addJob(self, runnable, name="UNTITLED"):
		self.queue.addJob(runnable, self.name + ' ' + name)
		self.lazyLoad()
		
	def addNumThreads(self, num):
		self.resetNumThreads(self.max + num)
	
	def addThread(self):
		t = CommandThread(self)
		self.threads.append(t)
		t.start()
		
	def periodic_exec(self, pt):
		def execute():
			pt.run()
			if pt.repeat: self.addPeriodicTask(pt)
		self.addJob(execute, pt.name)
		
	def periodic_loop(self):
		print('Starting periodic task loop for '+self.name)
		while self.queue.running:
			i = len(self.periodic)
			if i == 0: time.sleep(0.1)
			else:
				now = self.currentTimeMillis()
				n = 0
				while i>0:
					i -= 1
					pt = self.periodic[i]
					if pt.dead: self.periodic.pop(i)
					else:
						#FIXME - adjust n for now plus 100 ms?
						if not pt.time_to_run > now:
							n += 1
							self.periodic.pop(i)
							self.periodic_exec(pt)
				if n == 0: time.sleep(0.1)
	
	def init(self):
		pass
		
	def addPeriodicTask(self, pt, millis=None, name="UNTITLED PERIODIC TASK", isrun=None, repeat=True):
		if self.ptt == None: 
			self.ptt = threading.Thread(target=self.periodic_loop)
			self.ptt.start()
		if pt in self.periodic:
			print("WARNING! Attempt to add the same periodic task twice! "+pt.name)
		else:
			if (millis != None):
				pt = PeriodicTask(pt, millis, repeat, name, isrun)
			self.lazyLoad()
			pt.time_to_run = self.currentTimeMillis() + pt.millis
			self.periodic.append(pt)
	
	def bye(self, ct):
		self.threads.remove(ct)
	
	def shutdown(self):
		self.queue.running = False
		self.takeAllThreadsOffDuty()
				
	def takeAllThreadsOffDuty(self):
		self.resetNumThreads(0)
		
	def killCurrentThread(self):
		t = threading.currentThread()
		print("Killing thread "+t.getName())
		t.takeOffDuty()
	
	def resetNumThreads(self, num):
		self.max = num
		numthreads = self.size()
		numtokill = numthreads - num
		while numtokill > 0:
			numtokill -= 1
			self.addJob(self.killCurrentThread)
		
	
	
	
	
	