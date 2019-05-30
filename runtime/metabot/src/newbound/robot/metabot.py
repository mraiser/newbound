import os
import json
import urllib.parse
from .botbase import BotBase

class MetaBot(BotBase):

    DB = "metabot";
    ID = "jhlxnj1613883950bj298";

    def getServiceName(self):
        return 'metabot'

    def init(self, root, master):
        super().init(root, master)
        libraries = self.appproperties['libraries'].split(',')
        for lib in libraries:
            self.rebuildLibrary(lib)
        #FIXME - add timers
        #self.startTimers(lib)

    def libVersion(self, lib):
        hashdir = os.path.join(self.getBot('metabot').root, 'libraries')
        f = os.path.join(hashdir, lib+'.json')
        if os.path.exists(f):
            jo = json.loads(self.readFile(f).decode())
            if 'version' in jo: return int(jo['version'])
        return 0

    def jsapi(self, db, id, ctl):
        #print('Rebuilding Javascript API for '+db+':'+id+' ('+ctl['name']+')')
        b = self.master
        newhtml = ''
        if 'cmd' in ctl:
            for cmd in ctl['cmd']:
                name = cmd["name"]
                cmd = self.getData(db, cmd['id'])['data']
                newhtml += "function send_"+name+"(";
                lang = 'java'
                cmdid = None
                if 'python' in cmd:
                    lang = 'python'
                    cmdid = cmd[lang]
                elif 'type' in cmd:
                    lang = cmd['type']
                    if lang in cmd: cmdid = cmd[lang]
                    else: cmdid = cmd['cmd']
                data = self.getData(db, cmdid)['data']
                params = {}
                if 'params' in data: params = data['params']
                args = '{'
                n = 0
                for p in params:
                    typ = p['type']
                    if not typ == 'Bot' and not typ == 'Data':
                        newhtml += p['name']
                        newhtml += ', '
                        if n>0: args += ', '
                        n += 1
                        args += p['name']+': '+p['name']
                args += '}'

                newhtml += "xxxxxcb, xxxxxpeer){\n"
                # FIXME - remove when other languages are supported
                if 'python' not in cmd:
                    newhtml += "  console.log('unimplemented python call "+db+":"+ctl['name']+":"+name+"');\n"
                    newhtml += "  err = {\"status\":\"err\",\"msg\":\"Not implemented in python "+db+":"+ctl['name']+":"+name+"\"};\n"
                    newhtml += "  xxxxxcb(err);\n"
                else:
                    newhtml += "  var args = " + args + ";\n"
                    newhtml += "  var xxxprefix = xxxxxpeer ? '../peerbot/remote/'+xxxxxpeer+'/' : '../';\n"
                    newhtml += "  args = encodeURIComponent(JSON.stringify(args));\n";
                    newhtml += "  json(xxxprefix+'botmanager/execute', '"+"db="+urllib.parse.quote(db)+"&id="+urllib.parse.quote(cmd["id"])+"&args='+args, function(result){\n    xxxxxcb(result);\n  });\n"
                newhtml += "}\n"
        return newhtml

    def buildJSAPI(self, lib, id):
        ctl = self.getData(lib, id)['data']
        if 'name' not in ctl: ctl['name'] = id

        bm = self.master
        f = os.path.join(bm.root, 'html')
        f = os.path.join(f, 'generated')
        f = os.path.join(f, 'js')
        f = os.path.join(f, lib)
        self.mkdirs(f)
        f = os.path.join(f, id+'.js')
        self.writeFile(f, self.jsapi(lib, id, ctl).encode())
        ctl['status'] = 'ok'
        return ctl

    def rebuildLibrary(self, lib, clean = True):
        bm = self.master
        libdir = bm.getDB(lib)
        version = str(self.libVersion(lib))
        f = os.path.join(libdir, 'version.txt')
        if not clean:
            if os.path.exists(f):
                if self.readFile(f).decode() == version:
                    return
        controls = self.getData(lib, 'controls')['data']['list']
        for ctlptr in controls:
            id = ctlptr['id']
            ctl = self.buildJSAPI(lib, id)
            if 'cmd' in ctl:
                for cmd in ctl['cmd']:
                    cmd = self.getData(lib, cmd['id'])['data']
                    lang = 'java'
                    if 'python' in cmd: lang = 'python'
                    elif 'type' in cmd: lang = cmd['type']
                    #FIXME - Implement Code module, support other languages
                    if lang == 'python':
                        codeid = None
                        if lang in cmd: codeid = cmd[lang]
                        else: codeid = cmd['cmd']
                        meta = self.getData(lib, codeid)['data']
                        code = meta[lang]
                        #print(json.dumps(cmd))
                        #print(json.dumps(meta))
                        #print('----------------------')
                        imports = ''
                        if 'import' in meta: imports = meta['import']
                        params = meta['params']
                        bm.writePythonFile(lib, cmd['id'], params, imports, code)
        self.writeFile(f, version.encode())

    def apps(self, params):
        bm = self.master
        apps = {}
        installed = [type(self.master).__module__+'.'+type(self.master).__name__]
        for bot in self.master.bots:
            b = self.master.bots[bot]
            installed.append(type(b).__module__+'.'+type(b).__name__)
        apps['installed'] = installed
        f = self.getParentFile(b.root)
        sa = os.listdir(f)
        ja = []
        for s in sa:
            f2 = os.path.join(f, s)
            if os.path.exists(os.path.join(f2, 'app.properties')):
                ja.append(self.app(s))
        apps['list'] = ja
        return apps

    def app(self, id):
        f = os.path.join(os.path.join(self.getParentFile(self.root), id), 'app.properties')
        p = self.load_properties(f)
        jo = {
            'id': id,
            'service': id
        }
        if 'libraries' in p: jo['libraries'] = p['libraries'].split(',')
        else: jo['libraries'] = []

        if 'ctldb' in p:
            ctl = {
                'db': p['ctldb'],
                'id': p['ctlid']
            }
            jo['control'] = ctl

        if 'name' in p: jo['name'] = p['name']
        else: jo['name'] = id

        if 'desc' in p: jo['desc'] = p['desc']
        else: jo['desc'] = "The "+jo['name']+" application"

        if 'index' in p: jo['index'] = p['index']
        else: jo['index'] = "index.html"

        if 'price' in p: jo['price'] = float(p['price'])
        else: jo['price'] = 0

        if 'forsale' in p: jo['forsale'] = p['forsale'] == 'true'
        else: jo['index'] = True

        if 'img' in p: jo['img'] = p['img']
        else: jo['img'] = "/metabot/img/icon-square-app-builder.png"

        if 'botclass' in p: jo['class'] = p['botclass']
        else: jo['class'] = "newbound.robot.published."+id.lower()+"."+id

        if 'version' in p: jo['version'] = p['version']
        else: jo['version'] = "0"

        if 'vendor' in p: jo['vendor'] = p['vendor']
        else: jo['vendor'] = self.getLocalID()

        if 'vendorversion' in p: jo['vendorversion'] = p['vendorversion']
        else: jo['vendorversion'] = "0"

        if 'author' in p: jo['author'] = p['author']
        else: jo['author'] = self.getLocalID() # FIXME - add authorname & authororg from identity

        if 'authorname' in p: jo['authorname'] = p['authorname']
        if 'authororg' in p: jo['authororg'] = p['authororg']

        if 'hash' in p: jo['hash'] = p['hash']
        if 'signature' in p: jo['signature'] = p['signature']
        if 'key' in p: jo['key'] = p['key']

        if 'generate' in p: jo['generate'] = p['generate'].split(',')
        else: jo['generate'] = []

        jo['active'] = self.getBot(id) != None
        jo['published'] = 'key' in p

        return jo

    def handleLibraries(self, params):
        b = self.master

        installed = {}
        ja = []
        installed['list'] = ja

        f = os.path.join(self.getParentFile(self.getParentFile(b.root)), 'data')
        ff = os.path.join(self.getBot('metabot').root, 'libraries')
        self.mkdirs(ff)

        sa = os.listdir(f)
        for s in sa:
            f2 = os.path.join(f, s)
            if os.path.isdir(f2) and not s.startswith('.'):
                f3 = os.path.join(f2, 'meta.json')
                jo3 = {}
                if os.path.exists(f3): jo3 = json.loads(self.readFile(f3).decode())
                ff2 = os.path.join(ff, s+'.json')
                jo2 = {}
                if os.path.exists(ff2): jo2 = json.loads(self.readFile(ff2).decode())
                jo2['id'] = s
                jo2['name'] = s
                if 'readers' in jo3: jo2['readers'] = jo3['readers']
                if 'writers' in jo3: jo2['writers'] = jo3['writers']
                if 'crypt' in jo3: jo2['encryption'] = 'AES'
                else: jo2['encryption'] = 'NONE'
                ja.append(jo2)

        o = self.newResponse()
        o['data'] = installed
        return o

    def handleCommand(self, cmd, params):
        #if cmd == 'libraries': return self.handleLibraries(params)
        jo = self.call(cmd, params)
        #if 'data' in jo:
        #o = jo['data']
        #t = type(o).__name__
        #print('waka '+t)
        #if t != 'dict': return o
        return jo

    def call(self, cmd, params, db = None, ctl = None):
        #FIXME - implement code module
        if db == None: db = self.DB
        if ctl == None: ctl = self.ID
        id = self.lookupCmdID(db, ctl, cmd)
        if id == None:
            raise Exception("UNKNOWN COMMAND: "+cmd)
        p = {
            'db': db,
            'id': id,
            'sessionid': params['sessionid']
        }
        return self.master.execute(db, id, params, p)

    def lookupCmdID(self, db, ctl, cmd):
        ctl2 = self.lookupCtlID(db, ctl)
        if ctl2 != None: ctl = ctl2
        try:
            data = self.getData(db, ctl)['data']
            ja = data['cmd']
            for jo in ja:
                if jo['name'] == cmd: return jo['id']
        except:
            print('ouch')
            return None

    def lookupCtlID(self, db, name):
        controls = self.getData(db, 'controls')['data']['list']
        for ctlptr in controls:
            if ctlptr['name'] == name: return ctlptr['id']
            if ctlptr['id'] == name: return name

    #FIXME - maybe think about caching this?
    def getCommands(self):
        commands = {}
        data = self.getData(self.DB, self.ID)['data']
        if 'cmd' in data:
            ja = data['cmd']
            for jo in ja:
                lang = 'java'
                if 'lang' in jo: lang = jo['lang']
                code = self.getData(self.DB, jo[lang])['data']
                cmd = {}
                if 'groups' in code: cmd['groups'] = code['groups']
                if 'desc' in code: cmd['desc'] = code['desc']
                commands[jo['name']] = cmd
                params1 = code['params']
                params2 = []
                for p in params1: params2.append(p['name'])
                cmd['parameters'] = params2
        return commands
