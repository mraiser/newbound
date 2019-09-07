from ..primitive import Primitive


class Int(Primitive):

    def __init__(self):
        super().__init__('{"in": {"a": {} }, "out": { "b": {} } }')

    def execute(self, input):
        out = {}
        a = str(input.get("a"))
        i = a.find(".")
        if i != -1:
            a = a[:i]
        b = int(a)
        out["b"] = b
        return out
