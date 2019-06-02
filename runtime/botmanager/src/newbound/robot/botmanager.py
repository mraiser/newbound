import os
import sys
import json
import copy
import traceback

from ..crypto.supersimplecipher import SuperSimpleCipher
from .botbase import BotBase
from .loadpython import loadpython

class BotManager(BotBase):
    def getServiceName(self):
        return 'botmanager'

    def getIndexFileName(self):
        return "index.html"

    def getBot(self, bot):
        if bot == self.getServiceName(): return self
        if bot in self.bots: return self.bots[bot]
        return None

    def init(self, root):
        super().init(root)
        # FIXME - add discovery
        # FIXME - add timers
        self.keys = None
        self.bots = {}
        home = self.getParentFile(self.root)
        bots = ['securitybot', 'peerbot', 'metabot']
        if 'pybots' in self.properties: bots = self.properties['pybots'].split(',')
        else:
            self.properties['pybots'] = ','.join(bots)
            self.saveSettings()
        for bot in bots:
            try:
                botroot = os.path.join(home, bot)
                sys.path.append(os.path.join(botroot, 'src'))
                p = self.load_properties(os.path.join(botroot, 'app.properties'))
                claz = p['pybotclass']
                m = self.get_class(claz)
                b = m()
                self.bots[bot] = b
                b.init(botroot, self)
            except Exception as e:
                print('Error initializing bot '+bot+': '+str(e))
                traceback.print_exc(file=sys.stdout)
        self.initializationComplete()
        for bot in bots:
            try:
                self.getBot(bot).initializationComplete()
            except Exception as e:
                print('Error post-initializing bot '+bot+': '+str(e))
                traceback.print_exc(file=sys.stdout)

    def handleCommand(self, cmd, params):
        if cmd == 'newdb': return self.handleNewDB(params)
        if cmd == 'read': return self.handleRead(params)
        if cmd == 'write': return self.handleWrite(params)
        if cmd == 'delete': return self.handleDelete(params)
        if cmd == 'compile': return self.handleCompile(params)
        if cmd == 'savepython': return self.handleSavePython(params)
        if cmd == 'execute': return self.handleExecute(params)
        if cmd == 'getsettings': return self.handleGetSettings(params)
        if cmd == 'listbots': return self.handleListBots(params)
        if cmd.startswith('asset/'): return self.handleAsset(cmd[6:], params)
        raise Exception('Unknown command: '+cmd)

    def handleAsset(self, filename, params):
        i = filename.index('/')
        filename = self.getAsset(filename[0:i], filename[i+1:])
        f = open(filename, "rb")
        return f

    def handleListBots(self, params):
        includeself = False
        if 'includeself' in params: includeself = (params['includeself'] == 'true')
        o = self.newResponse()
        botnames = []
        if includeself: botnames.append(self.getServiceName())
        for name in self.bots: botnames.append(name)
        ja = []
        o['data'] = ja
        for name in botnames:
            b = self.getBot(name)
            p = copy.copy(b.appproperties)
            p['botname'] = b.getServiceName()
            p['pybotclass'] = type(b).__module__+'.'+type(b).__name__
            p['index'] = b.getIndexFileName()
            ja.append(p)

        return o

    def handleGetSettings(self, params):
        b = False
        if 'machineid' in params:
            self.properties['machineid'] = params['machineid']
            b = True
        if 'portnum' in params:
            self.properties['portnum'] = params['portnum']
            b = True
        if 'requirepassword' in params:
            self.properties['requirepassword'] = params['requirepassword']
            b = True
        if 'syncapps' in params:
            self.properties['syncapps'] = params['syncapps']
            b = True
        if 'issetup' in params:
            self.properties['issetup'] = params['issetup']
            b = True
        if 'defaultbot' in params:
            self.properties['defaultbot'] = params['defaultbot']
            b = True
        if 'discovery' in params:
            self.properties['discovery'] = params['discovery']
            b = True
        #FIXME - start/stop discovery

        if b: self.saveSettings()

        d = self.newResponse()
        if 'machineid' in self.properties: d['machineid'] = self.properties['machineid']
        if 'portnum' in self.properties: d['portnum'] = self.properties['portnum']
        if 'requirepassword' in self.properties: d['requirepassword'] = self.properties['requirepassword']
        if 'syncapps' in self.properties: d['syncapps'] = self.properties['syncapps']
        if 'issetup' in self.properties: d['issetup'] = self.properties['issetup']
        if 'defaultbot' in self.properties: d['defaultbot'] = self.properties['defaultbot']
        if 'discovery' in self.properties: d['discovery'] = self.properties['discovery']

        return d

    def indent(self, text, amount):
        ch=' '
        padding = amount * ch
        return ''.join(padding+line for line in text.splitlines(True))

    def handleExecute(self, params):
        #FIXME - implement Code module
        db = params['db']
        id = params['id']
        args = json.loads(params['args'])
        return self.execute(db, id, args, params)

    def execute(self, db, id, args, params):
        # FIXME - support other languages
        src = self.handleRead(params)["data"]
        #print(src)
        p = None
        t = 'JSONObject'
        if 'python' in src:
            c = self.getData(db, src['python'])['data']
            #print(c)
            p = c['params']
            if 'returntype' in c: t = c['returntype']
        #elif 'params' in src: p = src['params']
        else:
            c = self.getData(db, src['cmd'])['data']
            #print(c)
            p = c['params']
            if 'returntype' in c: t = c['returntype']
        d = {}
        for param in p:
            n = param['name']
            #print(param)
            if param['type'] == 'Bot': d[n] = self.getBot(n)
            elif n in args: d[n] = args[n]
        #FIXME - add "Data" type
        module = 'robot.'+db+"."+id
        path = self.getPythonFile(db, id)
        claz = loadpython(module, path)
        o = claz.lambda_function(**d)
        if t == 'JSONObject':
            o = {
                'status': 'ok',
                'data': o
            }
        return o

    def writePythonFile(self, db, id, p, imports, python):
        top = ''
        bottom = ''
        invoke = ''

        #if 'sys' not in imports: imports = 'import sys\n'+imports
        #if 'json' not in imports: imports = 'import json\n'+imports

        n = len(p)
        i = 0
        while i<n:
            if not invoke == '': invoke += ', '
            o = p[i]
            name = o['name']
            invoke += name
            i += 1

        f = self.getPythonFile(db, id)

        code =  imports + "\ndef lambda_function("+invoke+"):\n"
        code += self.indent(python, 2)+"\n"

        self.writeFile(f, code.encode())

    def handleCompile(self, params):
        return self.handleSavePython(params)

    def handleSavePython(self, params):
        db = params['db']
        id = params['id']
        cmd = params['cmd']
        python = params['python']
        imports = params['import']
        returntype = params['returntype']
        sessionid = params['sessionid']
        p = json.loads(params['params'])

        readers = None
        writers = None
        if 'readers' in params: readers = params['readers']
        if 'writers' in params: writers = params['writers']

        self.writePythonFile(db, id, p, imports, python)

        d = {
            'type': 'python',
            'id': id,
            'cmd': cmd,
            'params': p,
            'status': 'ok'
        }

        return d

    def getPythonFile(self, db, id):
        root = os.path.join(self.getParentFile(self.getParentFile(self.root)), 'generated')
        self.mkdirs(root)
        f = os.path.join(root, "robot")
        f = os.path.join(f, "published")
        f = os.path.join(f, db)
        self.mkdirs(f)
        f = os.path.join(f, id+'.py')
        return f

    def handleNewDB(self, params):
        db = params['db']
        sessionid = params['sessionid']
        session = self.getSession(sessionid)
        # FIXME - must be logged in
        username = 'xxx' #session['username']

        f = self.getDB(db)
        f2 = os.path.join(f, 'meta.json')
        if os.path.exists(f2): raise Exception('That database already exists')

        self.mkdirs(f)

        meta = {
            "id": db,
            "username": username
        }

        if 'readers' in params: meta['readers'] = json.loads(params['readers'])
        if 'writers' in params: meta['writers'] = json.loads(params['writers'])

        writekey = None
        encryption = params.get("encryption", None)
        if encryption is None or encryption == "AES":
            writekey = SuperSimpleCipher.getSeed()
            crypt = writekey.hex()
            meta["crypt"] = crypt

        self.writeFile(f2, json.dumps(meta).encode())

        ssca = []
        if writekey is not None:
            ssca.append(SuperSimpleCipher(writekey))
            ssca.append(SuperSimpleCipher(writekey))
        self.keys[db] = ssca

        self.fireEvent("newdb", meta)

        return "OK"

    def handleDelete(self, params):
        db = params['db']
        id = params['id']
        sessionid = params['sessionid']
        if not self.checkAuth(db, id, sessionid, True):
            raise Exception("UNAUTHORIZED")

        keys = self.getKeys(db)
        f = self.getDataFile(db, id, keys)
        name = id
        if keys:
            name = keys[1].encrypt(bytes(id)).hex()
        f = self.getSubDir(f, name, 4, 4)
        f = os.path.join(f, name)
        if not os.path.exists(f): raise Exception("No such record "+db+"/"+id)
        os.remove(f)
        return self.newResponse()

    def handleRead(self, params):
        db = params['db']
        id = params['id']
        if 'sessionid' not in params or not self.checkAuth(db, id, params['sessionid'], False):
            raise Exception("UNAUTHORIZED")
        return self.getData(db, id)

    def getData(self, db, id):

        keys = self.getKeys(db)
        f = self.getDataFile(db, id, keys)
        if not os.path.exists(f): raise Exception("No such record "+db+"/"+id)

        with open(f, "rb") as f:
            ba = f.read().decode()
        if not keys:
            jo = json.loads(ba)
        else:
            jo = keys[0].decrypt(ba)
        # d = json.loads(self.readFile(f).decode())
        # d['status'] = 'ok'
        # return d
        return jo

    def handleWrite(self, params):
        db = params['db']
        sessionid = params['sessionid']

        id = None
        if 'id' in params: id = params['id']
        else: id = self.uniqueSessionID()

        if not self.checkAuth(db, id, sessionid, True):
            raise Exception("UNAUTHORIZED")
        data = json.loads(params['data'])

        readers = None
        writers = None
        if 'readers' in params: readers = json.loads(params['readers'])
        if 'writers' in params: writers = json.loads(params['writers'])

        return self.setData(db, id, data, readers, writers, sessionid)

    def setData(self, db, id, data, readers, writers, sessionid=None):
        # FIXME - get name if logged in
        sessionlocation = ''
        username = 'xxx' #session['username']
        if sessionid is None:
            sessionid = ''
            username = 'system'
        else:
            session = self.getSession(sessionid)
            sessionlocation = session['userlocation']

        keys = self.getKeys(db)
        f = self.getDataFile(db, id, keys)
        name = id
        if keys:
            name = keys[1].encrypt(bytes(id)).hex()
        f = self.getSubDir(f, name, 4, 4)
        self.mkdirs(self.getParentFile(f))
        f = os.path.join(f, name)

        d = {
            "id": id,
            "data": data,
            "username": username,
            "sessionid": sessionid,
            "addr": sessionlocation,
            "time": self.currentTimeMillis()
        }
        if readers is not None: d["readers"] = readers
        if writers is not None: d["writers"] = writers

        ba = json.dumps(d)
        if keys:
            ba = keys[1].encrypt(ba).hex()

        self.writeFile(f, ba)

        d['db'] = db
        self.fireEvent("write", d)

        d = self.newResponse()
        d['id'] = id

        return d

    def getDB(self, db):
        home = self.getParentFile(self.root)
        home = self.getParentFile(home)
        home = os.path.join(home, 'data')
        home = os.path.join(home, db)
        return home

    def getKeys(self, db):
        ssca = self.keys.get(db, None)
        if ssca is None:
            with open(os.path.join(self.getDB(db), "meta.json")) as f:
                jo = json.load(f.read())
            ssca = []
            if "crypt" in jo:
                writekey = bytes.fromhex(jo["crypt"])
                ssca.append(SuperSimpleCipher(writekey))
                ssca.append(SuperSimpleCipher(writekey))
        return ssca

    def getAsset(self, db, filename):
        home = self.getDB(db)
        home = os.path.join(home, '_ASSETS')
        home = os.path.join(home, filename)
        return home

    def checkAuth(self, db, id, sessionid, iswrite):
        #FIXME - must be logged in
        return True

    def getDataFile(self, db, id, keys):
        f = self.getDB(db)
        name = id
        if keys:
            name = keys[1].encrypt(bytes(id)).hex()
        f = self.getSubDir(f, name, 4, 4)
        f = os.path.join(f, name)
        return f

    def getMachineID(self):
        return self.properties['machineid']

    commands = {
        "discover":{
            "parameters":[

            ],
            "desc":"Return the list of peers available on the local network."
        },
        "newdb":{
            "include":[
                "admin"
            ],
            "groups":"admin",
            "exclude":[

            ],
            "parameters":[
                "db",
                "readers",
                "writers",
                "encryption",
                "sessionid"
            ],
            "desc":"Create a new library with the given name, encryption and permissions. If permissions are not specified, admin access will be required to access the library. Currently supported encryption types are AES and NONE."
        },
        "read":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "db",
                "id",
                "sessionid"
            ],
            "desc":"Read the given record from the given library."
        },
        "restart":{
            "desc":"Restart the Newbound Network on this device."
        },
        "setdeviceinfo":{
            "desc":"Deprecated. Do not use."
        },
        "delete":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "db",
                "id",
                "sessionid"
            ],
            "desc":"Delete the given record from the given library."
        },
        "execute":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "db",
                "id",
                "args",
                "sessionid"
            ],
            "desc":"Execute the given command."
        },
        "listbots":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "desc":"List all currently running apps."
        },
        "timer":{
            "parameters":[
                "id",
                "mode",
                "params"
            ],
            "desc":"Administer timer rules. Supported modes are 'get', 'set' and 'kill'."
        },
        "primitives":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[

            ],
            "desc":"List the primitive functions installed on this device."
        },
        "savepython":{
            "parameters":[
                "db",
                "id",
                "cmd",
                "java",
                "python",
                "js",
                "params",
                "import",
                "returntype",
                "readers",
                "writers",
                "sessionid"
            ],
            "desc":"Save the given command."
        },
        "compile":{
            "parameters":[
                "db",
                "id",
                "cmd",
                "java",
                "python",
                "js",
                "params",
                "import",
                "returntype",
                "readers",
                "writers",
                "sessionid"
            ],
            "desc":"Compile the given command."
        },
        "convertdb":{
            "include":[
                "admin"
            ],
            "groups":"admin",
            "exclude":[

            ],
            "parameters":[
                "db",
                "readers",
                "writers",
                "encryption",
                "sessionid"
            ],
            "desc":"Convert the permissions and on-disk encryption for this library. Currently supported encryption types are AES and NONE."
        },
        "startbot":{
            "desc":"Deprecated. Do not use."
        },
        "getsettings":{
            "parameters":[
                "issetup",
                "defaultbot",
                "discovery",
                "machineid",
                "portnum",
                "requirepassword",
                "syncapps",
                "password"
            ],
            "desc":"All parameters are optional. Get or set basic system settings."
        },
        "jsearch":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "db",
                "id",
                "java",
                "imports",
                "json",
                "javascript",
                "readers",
                "writers",
                "delete",
                "sessionid",
                "sessionlocation"
            ],
            "desc":"Search the given library with the given saved search ID. If the java parameter is specified, it will replace the saved search algorithm with the given code."
        },
        "asset":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[

            ],
            "desc":"Return the given asset from the given library <br><b>Usage:<\/b> http://localhost:5773/botmanager/asset/LIBNAME/ASSETNAME.ext"
        },
        "write":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "parameters":[
                "db",
                "data",
                "id",
                "readers",
                "writers",
                "sessionid",
                "sessionlocation"
            ],
            "desc":"Write the data to the given library with the given permissions. If no record ID is provided, a unique one will be assigned and returned. The user who writes the record has default read access. If permissions are not specified, admin access will be required to access this record otherwise."
        },
        "savejava":{
            "parameters":[
                "db",
                "id",
                "cmd",
                "java",
                "python",
                "js",
                "params",
                "import",
                "returntype",
                "readers",
                "writers",
                "sessionid"
            ],
            "desc":"Save the given command."
        }
    }
