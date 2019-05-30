class PeriodicTask(object):

    def __init__(self, runnable, millis, repeat, name, isrun=None):
        self.runnable = runnable
        self.millis = millis
        self.repeat = repeat
        self.name = name
        self.isrun = isrun
        self.time_to_run = 0
        self.dead = False

    def die(self):
        self.dead = True

    def run(self):
        if self.isrun == None or self.isrun():
            self.runnable()
        else:
            self.repeat = False
