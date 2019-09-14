from ..primitive import Primitive


class Minus(Primitive):

    def __init__(self):
        super().__init__("""{"in": {"a": {}, "b", {}}, "out": { "c": {} } }""")

    def execute(self, inObj):
        out = {}
        a = inObj.get("a")
        b = inObj.get("b")
        c = self.subtract(a, b)
        out["c"] = c
        return out

    def subtract(self, a, b):

        return a - b
