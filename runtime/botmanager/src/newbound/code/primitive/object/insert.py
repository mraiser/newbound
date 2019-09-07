from ..primitive import Primitive


class Insert(Primitive):

    def __init__(self):
        super().__init__('{"in": {"a": {}, "b", {}}, "out": { "c": {} } }')

    def execute(self, input):
        out = {}
        a = input.get("a")
        b = input.get("b")
        a.append(b)
        c = a
        out["c"] = c
        return out
