
from .primitive.math.divide import Divide
from .primitive.math.equals import Equals
from .primitive.math.int import Int
from .primitive.math.minus import Minus
from .primitive.math.mod import Mod
from .primitive.math.multiply import Multiply
from .primitive.math.plus import Plus

from .primitive.object.get import Get
from .primitive.object.put import Put
from .primitive.object.remove import Remove
from .primitive.object.insert import Insert


class Code:

    class RO:
        def __init__(self, t, f, c):
            self.t = t  # timestamp
            self.f = f  # file
            self.c = c  # transform

    def __init__(self, code, lib):
        self.code = code
        self.lib = lib
        self.DEBUG = False
        self.ROOT = None
        self.PYTHON = "python3"

        self.EXT = {}

        self.PRIMS = {

            # MATH
            "+": Plus(),
            "-": Minus(),
            "*": Multiply(),
            "/": Divide(),
            "%": Mod(),
            "int": Int(),
            "equals": Equals(),

            # OBJECT
            "Get": Get(),
            "Put": Put(),
            "Remove": Remove(),

            # ARRAY
            "insert": Insert(),
        }

    def execute(self, args):

        # type = "flow" if not "type" in self.code else self.code["type"]
        # if type == "java":
        #     jt = self.precompile()
        #     return jt.execute(args)
        #
        # if type == "js":
        #     js = self.code["script"]
        #     return SYS.eval(js)
        #
        # if type == "python":
        #     py = self.code["id"]
        #     cmd = ""
        #     return self.evalCommandLine(self.PYTHON, cmd, args)

        out = {}
        self.code["out"] = out

        cmds = self.code["cmds"]
        cons = self.code["cons"]

        # Loop through and evaluate cmds
        for i, cmd in enumerate(cmds):

            if not cmd.get("done"):
                input = cmd["in"]

                if len(input) == 0:
                    self.evaluate(cmd)
                else:
                    b = True
                    for k in input.keys():
                        input[k]["done"] = False
                        con = self.lookupConnection(i, k, "in")
                        if con is None:
                            input[k]["done"] = True
                        else:
                            b = False
                    if b:
                        self.evaluate(cmd)

        done = False
        while not done:

            c = True
            for i, con in enumerate(cons):

                if not con.get("done"):
                    c = False
                    ja = con["src"]
                    src = int(ja[0])
                    srcname = ja[1]
                    ja = con["dest"]
                    dest = int(ja[0])
                    destname = ja[1]

                    b = False
                    value = None
                    if src == -1:   # input
                        value = args.get(srcname)
                        b = True
                    else:
                        cmd = cmds[src]
                        if cmd.get("done"):
                            value = cmd["out"].get(srcname)
                            b = True

                    if b:
                        con["done"] = True
                        if dest == -2:  # output
                            if value is not None:
                                out[destname] = value
                        else:
                            cmd = cmds[dest]
                            if cmd["type"] == "undefined":
                                cmd["done"] = True
                            else:
                                ins = cmd["in"]
                                var = ins.get(destname)
                                if value is not None:
                                    var["val"] = value
                                var["done"] = True

                                for k, v in ins.items():
                                    if not b:
                                        break
                                    b = b and v.get("done", False)

                                if b:
                                    self.evaluate(cmd)

            if c:
                done = True

        return out

    def precompile(self):
        pass

    def getRoot(self, old):
        pass

    def lookupConnection(self, cmd, name, which):
        cons = self.code["cons"]
        for con in reversed(cons):
            bar = con["dest" if which == "in" else "src"]
            if bar[1] == name:
                return con
        return None

    def evaluate(self, cmd):

        input2 = cmd["in"]
        input = {name: input3["val"] for name, input3 in input2.items() if "val" in input3}

        # for name, input3 in input2.items():
        #     if "val" in input3:
        #         input[name] = input3["val"]
        #     if self.DEBUG:
        #         print("{} {}({})".format("HAS" if "val" in input3 else "MISSING", name, input3))

        out = {}

        type = cmd["type"]

        if type == "primitive":
            out = self.PRIMS.get(cmd["name"]).execute(input)
        # elif type == "code":
        #     code = cmd["code"]
        #     c = Code(code, self.lib)
        #     out = c.execute(input)
        # elif type == "peer":
        #
        # elif type == "constant":
        #     out = cmd["out"]
        #     for k, v in out:
        #         val = cmd["name"]
        #         ctype = cmd["ctype"]
        #
        #         if ctype == "int":
        #             val = int(val)
        #         elif ctype == "decimal":
        #             val = float(val)
        #         elif ctype == "boolean":
        #             val = bool(val)
        else:
            out = {}

        cmd["out"] = out
        cmd["done"] = True
        return cmd

    def evalCommandLine(self, app, cmd, args):
        pass