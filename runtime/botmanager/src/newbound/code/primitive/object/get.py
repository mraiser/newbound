from ..primitive import Primitive


class Get(Primitive):

    def __init__(self):
        super().__init__('{"in": {"a": {}, "b", {}}, "out": { "c": {} } }')

    def execute(self, input):
        out = {}
        a = input.get("a")
        if isinstance(a, list):
            b = input["b"]
            c = a[b]
        else:
            # dict assumed
            b = input["b"]
            c = a[b]
        out["c"] = c
        return out
