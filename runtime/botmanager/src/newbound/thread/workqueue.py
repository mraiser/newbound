import threading
from queue import Queue
from .job import Job

class WorkQueue(object):
		
	def __init__(self):
		self.queue = Queue()
		self.len = 0
		self.running = True
		
	def addJob(self, runnable, name="UNTITLED"):
		job = Job(runnable, name)
		self.len += 1
		self.queue.put(job)
	
	def getSomeWork(self, seconds=5):
		try:
			job = self.queue.get(True, seconds)
			self.len -= 1
			return job
		except:
			return None

	def size(self):
		return self.len