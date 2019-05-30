import socket
from .tcpsocket import TCPSocket

class TCPServerSocket(object):

    def __init__(self, port):
        self.port = port
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind(("", port))
        self.port = self.socket.getsockname()[1]
        self.socket.listen()

    def getPort(self):
        return self.port

    def getAddress(self):
        return self.socket.getsockname()[0]

    def accept(self):
        conn, addr = self.socket.accept()
        return TCPSocket(conn, addr)
