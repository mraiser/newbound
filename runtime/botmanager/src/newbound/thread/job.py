class Job(object):

    def __init__(self, runnable, name):
        self.runnable = runnable
        self.name = name

    def run(self):
        self.runnable()

    def toString(self):
        return self.name
