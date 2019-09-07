from ..primitive import Primitive


class Remove(Primitive):

    def __init__(self):
        super().__init__('{"in": {"a": {}, "b", {}}, "out": { "c": {} } }')

    def execute(self, input):
        out = {}
        a = input.get("a")
        if isinstance(a, list):
            b = input["b"]
            c = a.pop(b)
        else:
            b = input["b"]
            c = a.pop(b, None)
        out["c"] = c
        return out
