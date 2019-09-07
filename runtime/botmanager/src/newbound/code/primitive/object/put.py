from ..primitive import Primitive


class Put(Primitive):

    def __init__(self):
        super().__init__('{"in": {"a": {}, "b", {}, "c", {}}, "out": { "d": {} } }')

    def execute(self, input):
        out = {}
        a = input.get("a")
        if isinstance(a, list):
            b = input["b"]
            c = input["c"]
            a[c] = b
            d = a
        else:
            b = input["b"]
            c = input["c"]
            a[b] = c
            d = a
        out["d"] = d
        return out
