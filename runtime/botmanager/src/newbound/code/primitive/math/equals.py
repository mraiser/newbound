from ..primitive import Primitive


class Equals(Primitive):

    def __init__(self):
        super().__init__('{"in": {"a": {}, "b", {}}, "out": { "c": {} } }')

    def execute(self, input):
        out = {}
        a = input.get("a")
        b = input.get("b")
        c = (a == b)
        out["c"] = c
        return out
