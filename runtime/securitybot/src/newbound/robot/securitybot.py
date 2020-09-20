import os
import json
import shutil
from .botbase import BotBase


class SecurityBot(BotBase):

    def init(self, root, master):
        super().init(root, master)
        b = False
        if 'requirepassword' not in self.properties:
            self.properties['requirepassword'] = "true"
            b = True
        if 'syncapps' not in self.properties:
            self.properties['syncapps'] = "true"
            b = True
        if b: self.saveSettings()

        f = os.path.join(self.root, 'users')
        if not os.path.exists(f):
            self.mkdirs(f)
            f = os.path.join(f, 'admin.properties')
            p = {
                'password':'admin',
                'groups':'admin',
                'displayname':'System Administrator'
            }
            self.save_properties(p, f)

        f = os.path.join(self.root, 'rules')
        if not os.path.exists(f):
            #f = os.path.join(f, 'peerbot')
            #f = os.path.join(f, 'stream')
            self.mkdirs(f)
        #f = os.path.join(f, 'groups.properties')
        #p = { 'anonymous':'include' }
        #self.save_properties(p, f)

    def initializationComplete(self):
        self.makeSurePeersAreUsers()
        if 'syncapps' not in self.properties or self.properties['syncapps'] == 'true':
            self.handleResetApps(None)
        else:
            self.setDefaults()
        super().initializationComplete()

    # def getSession(self, params):
    #
    #     sid = params.get("sessionid")
    #     print("Lookup session: {}".format(sid))
    #     if sid is not None:
    #         return self.sessions.get(sid)
    #     return None

    def validateRequest(self, bot, cmd, params):
        if 'sessionid' not in params:
            params['sessionid'] = self.uniqueSessionID()
        if '/' in cmd: cmd = cmd[0:cmd.index('/')]

        user = None
        username = None
        groups = None
        sid = params['sessionid']
        s = self.getSession(sid, True)

        if 'user' in s:
            user = s['user']
            username = s['username']
        else:
            f = os.path.join(self.getRootDir(), 'session.properties')
            if os.path.exists(f):
                p = self.load_properties(f)
                if sid in p:
                    username = p[sid]
                    user = self.getUser(username)
        if user is None:
            username = 'anonymous'
            user = {
                'groups': 'anonymous',
                'displayname': 'Anonymous',
                'password': ''
            }

        s['username'] = username
        s['user'] = user
        if 'emailusername' not in user:
            s['emailusername'] = username
            s['emailuser'] = user

        if 'groups' in user:
            groups = user['groups'].split(',')
        else:
            groups = []

        if 'admin' in groups:
            self.updateSessionTimeout(s)
            return

        b = False
        f2 = os.path.join(self.root, 'rules')
        f2 = os.path.join(f2, bot.getServiceName())
        f = os.path.join(f2, 'groups.properties')
        if os.path.exists(f):
            p = self.load_properties(f)
            b = self.checkGroups(groups, p)
        f = os.path.join(f2, cmd)
        f = os.path.join(f, 'groups.properties')
        if not b and os.path.exists(f):
            b = self.checkGroups(groups, self.load_properties(f))

        if not b:
            s2 = bot.getServiceName()+" cmd="+cmd+" user="+user["displayname"]+" groups="
            s2 += json.dumps(groups)
            raise Exception("UNAUTHORIZED: bot="+s2)

    def checkGroups(self, groups, rules):
        include = False
        exclude = False
        if 'anonymous' in rules:
            perm = rules['anonymous']
            if perm == 'include': include = True
        for group in groups:
            if group in rules:
                perm = rules[group]
                if perm == 'include': include = True
                elif perm == 'exclude': exclude = True
        if (exclude):
            raise Exception('UNAUTHORIZED')

        return include

    def handleCommand(self, cmd, params):
        if cmd == 'deviceinfo': return self.handleDeviceInfo(params)
        if cmd == 'listusers': return self.handleListUsers(params)
        if cmd == 'listapps': return self.handleListApps(params)
        if cmd == 'listgroups': return self.handleListGroups(params)
        if cmd == 'updateuser': return self.handleUpdateUser(params)
        if cmd == 'newuser': return self.handleNewUser(params)
        if cmd == 'deleteuser': return self.handleDeleteUser(params)
        if cmd == 'updateapp': return self.handleUpdateApp(params)
        if cmd == 'resetapps': return self.handleResetApps(params)
        if cmd == 'currentuser': return self.handleCurrentUser(params)
        if cmd == 'login': return self.handleLogin(params)
        raise Exception('Unknown command: '+cmd)

    def handleLogin(self, username, password, sid):

        if username is None or password is None:
            raise Exception("Invalid login attempt")

        user = self.getUser(username, False)
        if user is None:
            raise Exception("Invalid login attempt")

        s = user["password"]
        if s is not None and s == password:
            if sid is None:
                sid = self.uniqueSessionID()

            ses = self.getSession(sid, True)
            ses["username"] = username
            ses["user"] = user
            ses["emailusername"] = username
            ses["emailuser"] = user

            o = {
                "user": username,
                "sessionid": sid
            }
            self.fireEvent("login", o)
            o["status"] = "ok"
            o["msg"] = "You are now logged in, sessionid: {}".format(sid)
            return o

        self.fireEvent('loginfail', o)
        raise Exception("Invalid login attempt")

    def handleCurrentUser(self, params):
        o = self.newResponse()
        ses = self.getSession(params['sessionid'], True)
        if 'user' in ses:
            p = ses['user']
            o['displayname'] = p['displayname']
            o['username'] = ses['username']
            o['groups'] = p['groups']
        else:
            o['displayname'] = 'Anonymous'
            o['username'] = 'anonymous'
            o['groups'] = 'anonymous'
        return o

    def handleUpdateApp(self, params):
        o = self.newResponse()
        p = {}
        grouptypes = ['include', 'exclude']
        for gt in grouptypes:
            if gt in params:
                s = params[gt]
                if s != '':
                    sa = s.split(',')
                    for saj in sa:
                        o[saj] = gt
                        p[saj] = gt
        rulesdir = os.path.join(self.root, 'rules')
        f2 = os.path.join(rulesdir, params['id'])
        if 'cmd' in params:
            f2 = os.path.join(f2, params['cmd'])
        self.mkdirs(f2)
        f2 = os.path.join(f2, 'groups.properties')
        self.save_properties(p, f2)
        self.fireEvent('appupdate', o)
        return o

    def handleDeleteUser(self, params):
        username = params['username']
        f = self.getUserFile(username)
        if not os.path.exists(f):
            raise Exception("No such user: "+username)
        os.remove(f)
        o = self.newResponse()
        o['user'] = username
        self.fireEvent('deleteuser', o)
        return o

    def handleNewUser(self, params):
        return self.handleUpdateUser(params)

    def handleUpdateUser(self, params):
        username = params['username']
        f = self.getUserFile(username)
        o = { 'username': username }
        p = {}
        b = os.path.exists(f)
        if b: self.load_properties(f)
        if 'displayname' in params:
            p['displayname'] = params['displayname']
            o['displayname'] = params['displayname']
        if 'password' in params:
            p['password'] = params['password']
            o['password'] = params['password']
        if 'groups' in params:
            p['groups'] = params['groups']
            o['groups'] = params['groups']
        self.save_properties(p, f)
        ses = self.getSessionByUsername(username)
        if ses is not None: ses['user'] = p
        if not b: self.fireEvent('newuser', o)
        self.fireEvent('userupdate', o)
        o['status'] = 'ok'
        return o

    def handleListGroups(self, params):
        groups = []
        o = self.handleListUsers(params)['data']
        for u in o:
            gs = u['groups']
            for g in gs:
                if g not in groups:
                    groups.append(g)
        o = self.handleListApps(params)['data']
        for id in o:
            app = o[id]
            for cid in app['commands']:
                cmd = app['commands'][cid]
                if 'include' in cmd:
                    for g in cmd['include']:
                        if g not in groups:
                            groups.append(g)
                if 'exclude' in cmd:
                    for g in cmd['exclude']:
                        if g not in groups:
                            groups.append(g)
        o = self.newResponse()
        o['data'] = groups
        return o

    def handleListUsers(self, params):
        o = self.newResponse()
        ja = []
        o['data'] = ja
        root = os.path.join(self.root, 'users')
        fa = os.listdir(root)
        for f in fa:
            if f.endswith('.properties'):
                base = os.path.basename(f)
                id = os.path.splitext(base)[0]
                user = self.load_properties(os.path.join(root, f))
                if 'groups' in user: user['groups'] = user['groups'].split(',')
                else: user['groups'] = []
                user['username'] = id
                user['local'] = str(not self.getBot('peerbot').hasPeer(id)).lower()
                ja.append(user)
        return o

    def handleResetApps(self, params):
        f = os.path.join(self.root, 'rules')
        shutil.rmtree(f)
        self.setDefaults()

    def setDefaults(self):
        rulesdir = os.path.join(self.root, 'rules')
        apps = self.handleListApps(None)['data']
        for key in apps:
            f = os.path.join(rulesdir, key)
            self.mkdirs(f)
            bb = self.getBot(key)
            cmds = bb.getCommands()
            for k2 in cmds:
                cmd = cmds[k2]
                f2 = os.path.join(f, k2)
                if not os.path.exists(f2):
                    self.mkdirs(f2)
                    if 'desc' in cmd:
                        self.writeFile(os.path.join(f2, 'desc.html'), cmd['desc'].encode())
                    if 'groups' in cmd:
                        groups = cmd['groups']
                        sa = groups.split(',')
                        for group in sa:
                            f3 = os.path.join(f2, 'groups.properties')
                            p2 = {}
                            if os.path.exists(f3): p2 = self.load_properties(f3)
                            p2[group] = 'include'
                            self.save_properties(p2, f3)

    def handleListApps(self, params):
        o = self.newResponse()
        jo = {}
        o['data'] = jo
        rulesdir = os.path.join(self.root, 'rules')
        bots2 = self.master.bots
        bots = [self.master.getServiceName()]
        for id in bots2: bots.append(id)
        for id in bots:
            b = self.getBot(id)
            p = b.appproperties
            forsale = 'true'
            if 'forsale' in p: forsale = p['forsale']
            app = {
                'id': id,
                'name': p['name'],
                'desc': p['desc'],
                'forsale': forsale,
                'commands': self.getBot(id).getCommands()
            }
            jo[id] = app
            f3 = os.path.join(rulesdir, id)
            if os.path.exists(f3):
                f2 = os.path.join(f3, 'groups.properties')
                if os.path.exists(f2): self.extractGroupsForApp(f2, app)
                commands = app['commands']
                for command in commands:
                    cmd = commands[command]
                    f2 = os.path.join(f3, command)
                    f2 = os.path.join(f2, 'groups.properties')
                    if os.path.exists(f2): self.extractGroupsForApp(f2, cmd)
                    f2 = os.path.join(f3, command)
                    f2 = os.path.join(f2, 'desc.html')
                    if os.path.exists(f2): cmd['desc'] = self.readFile(f2).decode()
        return o

    def extractGroupsForApp(self, f, app):
        app['include'] = []
        app['exclude'] = []
        p = self.load_properties(f)
        for key in p:
            val = p[key]
            grouptype = None
            if val in app: grouptype = app[val]
            else:
                grouptype = []
                app[val] = grouptype
            if key not in grouptype:
                grouptype.append(key)



    def handleDeviceInfo(self, params):
        b = False
        if 'requirepassword' in params:
            self.properties['requirepassword'] = params['requirepassword']
            b = True
        if 'syncapps' in params:
            self.properties['syncapps'] = params['syncapps']
            b = True

        if b: self.saveSettings()

        d = self.newResponse()
        if 'requirepassword' in self.properties: d['requirepassword'] = self.properties['requirepassword']
        if 'syncapps' in self.properties: d['syncapps'] = self.properties['syncapps']
        return d

    def makeSurePeersAreUsers(self):
        bb = self.getBot('peerbot')
        jo = bb.handleCommand("connections", {})['data']
        for id in jo:
            peer = jo[id]
            self.createUser(id, peer['name'])

    def createUser(self, id, name=None, groups=None):
        u = self.getUser(id, False)
        b = False
        if u is None:
            u = {}
            b = True
        if 'displayname' not in u or (name is not None and name != u['displayname']):
            if name is None: name = id
            u['displayname'] = name
            b = True
        if 'password' not in u:
            u['password'] = self.uniqueSessionID()
            b = True
        if groups is not None:
            u['groups'] = groups
            b = True
        if b: self.saveUser(id, u)

    def getUser(self, id, create=False):
        f = self.getUserFile(id)
        if os.path.exists(f): return self.load_properties(f)
        if create: return self.createUser(id)
        return None

    def getUserFile(self, id):
        f = os.path.join(self.root, 'users')
        f = os.path.join(f, id + '.properties')
        return f

    def saveUser(self, id, u):
        f = self.getUserFile(id)
        self.save_properties(u, f)

    def handleRememberSession(self, cmd, params):

        session = self.getSession(params["sessionid"])
        user = session.get("username")
        f = os.path.join(self.getRootDir(), "session.properties")
        if os.path.exists(f):
            properties = self.load_properties(f)
        else:
            properties = {}
        properties["sessionid"] = user
        self.save_properties(properties, f)

        sid = params.get("sessionid")
        return {
            "status": "ok",
            "msg": "You are now logged in, sessionid: {}".format(sid),
            "sessionid": sid
        }

    commands = {
        "newuser":{
            "parameters":[
                "username",
                "realname",
                "password",
                "groups"
            ],
            "desc":"Create a new user."
        },
        "currentuser":{
            "desc":"Return information about the current user."
        },
        "listusers":{
            "desc":"List all users and peers. The &quot;local&quot; attribute is true for users and false for peers."
        },
        "listgroups":{
            "desc":"List all security groups."
        },
        "resetapps":{
            "desc":"Reset all apps to their default security settings."
        },
        "updateapp":{
            "parameters":[
                "include",
                "exclude",
                "id",
                "cmd"
            ],
            "desc":"Update the security settings for an app. All parameters are optional except id, which is the ID of the app you are updating. The include and exclude parameters are comma separated lists of groups. If the cmd parameter is passed, the include and exclude settings will be applied to that command. Otherwise, the settings will be applied to the app itself."
        },
        "deleteuser":{
            "parameters":[
                "username"
            ],
            "desc":"Delete a user."
        },
        "listapps":{
            "include":[
                "anonymous"
            ],
            "groups":"anonymous",
            "exclude":[

            ],
            "desc":"List all apps and their current security settings."
        },
        "deviceinfo":{
            "parameters":[
                "requirepassword",
                "syncapps"
            ],
            "desc":"All parameters are optional. Get or set basic security parameters. Turn security on or off, turn permission synching to defaults for apps on or off."
        },
        "updateuser":{
            "parameters":[
                "username",
                "displayname",
                "password",
                "groups"
            ],
            "desc":"Set basic information about the user."
        },
        "login":{
            "parameters":[
                "user",
                "pass"
            ],
            "groups":"anonymous",
            "desc":"Log in"
        }
    }

    def getServiceName(self):
        return 'securitybot'
