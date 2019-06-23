import time
import os
import urllib
from email.utils import formatdate
import mimetypes
import random
import uuid
import shutil
import socket
import sys
import traceback

class BotUtil(object):

    sep='='
    comment_char='#'
    nextid = 0
    hexchars = "0123456789abcdef"
    nonhexchars = "ghijklmnopqrstuvwxyz"

    def load_properties(self, filepath):
        if not os.path.exists(filepath): return None
        props = {}
        with open(filepath, "rt") as f:
            for line in f:
                l = line.strip()
                if l and not l.startswith(self.comment_char):
                    key_value = l.split(self.sep)
                    key = key_value[0].strip()
                    value = self.sep.join(key_value[1:]).strip().strip('"')
                    props[key] = value
        return props

    def save_properties(self, props, filepath):
        f = open(filepath, 'w')
        for key in props:
            f.write(key+self.sep+str(props[key])+'\n')
        f.close()

    def currentTimeMillis(self):
        return int(round(time.time() * 1000))

    def randomNonHex(self):
        i = random.randint(0, 19)
        return self.nonhexchars[i:i+1]

    def uniqueSessionID(self):
        if self.nextid > 65535: self.nextid = 0

        sid = self.randomNonHex()
        sid += self.randomNonHex()
        sid += self.randomNonHex()
        sid += self.randomNonHex()
        sid += self.randomNonHex()
        sid += self.randomNonHex()
        sid += hex(self.currentTimeMillis())[2:]
        sid += self.randomNonHex()
        sid += hex(self.nextid)[2:]

        self.nextid += 1
        return sid

    def lettersAndNumbersOnly(self, s):
        o = '';
        for c in s:
            if c in self.hexchars or c in self.nonhexchars:
                o += c
        return o

    def getParentFile(self, f):
        return os.path.abspath(os.path.join(f, os.pardir))

    def toHTTPDate(self, millis):
        d = formatdate(timeval=millis/1000, localtime=False, usegmt=True)
        #print(str(millis)+' - '+d)
        return d

    def getMIMEType(self, filename):
        return mimetypes.MimeTypes().guess_type(filename)[0]

    def writeFile(self, filename, b):
        f = open(filename, "wb")
        f.write(b)
        f.close()

    def readFile(self, filename):
        f = open(filename, "rb")
        b = f.read()
        f.close()
        return b

    def mkdirs(self, f):
        if not os.path.exists(f): os.makedirs(f)

    def getTempFile(self, tempfilename):

        tempfile = os.path.join(self.getParentFile(self.getParentFile(self.getRootDir())), "tmp")
        # tempfile = os.path.join(BotBase.master.getRootDir().getParentFile().getParentFile(), "tmp")
        tempfile = os.path.join(tempfile, "mime")
        self.mkdirs(tempfile)
        tempfile = os.path.join(tempfile, tempfilename)
        return tempfile

    def getSubDir(self, dir, name, chars, levels):
        s = name
        l = chars * levels
        while len(s) < l: s += '_'
        i = 0
        while (i<levels):
            n = i*chars
            i += 1
            dir = os.path.join(dir, s[n:n+chars])
        return dir

    def hexDecode(self, enc):
        out = ''
        while True:
            if '%' not in enc: break
            i = enc.index('%')
            out = out + enc[:i]
            enc = enc[i:]
            if len(enc)<3: break
            try:
                hex = bytes.fromhex(enc[1:3]).decode('utf8')
                out += hex
                enc = enc[3:]
            except:
                out += enc[:1]
                enc = enc[1:]
        return out + enc

    def copyFolder(self, d1, d2, replace=True):
        self.copyFile(d1, d2, replace)
    
    def copyFile(self, f1, f2, replace=True):
        if replace or not os.path.exists(f2):
            shutil.copy(f1, f2)

    def get_class(self, kls):
        parts = kls.split('.')
        module = ".".join(parts[:-1])
        m = __import__( module )
        for comp in parts[1:]:
            m = getattr(m, comp)
        return m

    def sendData(self, input, output, length=-1, chunksize=1024):
        numbytes = 0
        while True:
            if not length == -1: chunksize = min(length-numbytes, chunksize)
            b = input.read(chunksize)
            l = len(b)
            numbytes += l
            if l == 0: break
            output.sendall(b)
            if length == numbytes: break
        return numbytes

    def new_uuid(self):
        return str(uuid.uuid4())

    def get_ip(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('10.255.255.255', 1))
            IP = s.getsockname()[0]
        except:
            IP = '127.0.0.1'
        finally:
            s.close()
        return IP

    def int_to_bytes(self, x):
        return x.to_bytes(4, 'big')

    # FIXME - replaced by bytes_to_int
    def int_from_bytes(self, xbytes):
        return int.from_bytes(xbytes, 'big')

    def bytes_to_int(self, xbytes):
        return int.from_bytes(xbytes, 'big')

    def bytes_to_long(self, xbytes):
        return int.from_bytes(xbytes, 'big')

    def long_to_bytes(self, x):
        return x.to_bytes(8, 'big')

    def printStackTrace(self, e):
        traceback.print_exc(file=sys.stdout)


