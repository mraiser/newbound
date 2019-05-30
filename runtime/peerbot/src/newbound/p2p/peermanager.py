import os
from .peer import Peer
from newbound.robot.botbase import BotUtil

class PeerManager(BotUtil):
    def __init__(self, p2p, root):
        self.p2p = p2p
        self.root = root
        self.peers = {}

    def getPeer(self, uuid, create=True):
        if uuid in self.peers: return self.peers[uuid]
        p = self.loadPeer(uuid)
        if p == None and create:
            p = Peer(self.p2p, uuid, {})
            self.savePeer(p)
        self.peers[uuid] = p
        return p

    def savePeer(self, peer):
        p = peer.toProperties()
        f = self.getPeerFile(peer.id)
        self.mkdirs(os.path.dirname(f))
        self.save_properties(p, f)
        print("Saved peer "+peer.name+"/"+peer.id)

    def loadPeer(self, uuid):
        f = self.getPeerFile(uuid)
        p = self.load_properties(f)
        if p != None: return Peer(self.p2p, uuid, p)
        return None

    def getPeerFile(self, uuid):
        f = os.path.join(self.root, 'peers')
        f = self.getSubDir(f, uuid, 2, 3)
        f = os.path.join(f, uuid)
        return f

    def hasPeer(self, uuid):
        return os.path.exists(self.getPeerFile(uuid))
