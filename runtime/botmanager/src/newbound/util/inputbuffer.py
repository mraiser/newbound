from queue import Queue


class InputBuffer(object):
    def __init__(self):
        self.queue = Queue()
        self.buf = b''

    def incoming(self, ba):
        self.queue.put(ba)

    def readall(self, n):
        # FIXME - probably should time out eventually
        llen = len(self.buf)
        if llen >= n:
            ba = self.buf[:n]
            self.buf = self.buf[n:]
            return ba
        else:
            ba = self.buf
            self.buf = self.queue.get()
            ba += self.readall(n-llen)
            return ba

