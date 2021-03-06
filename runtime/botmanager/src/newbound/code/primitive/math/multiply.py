from ..primitive import Primitive, is_number


class Multiply(Primitive):

    def __init__(self):
        super().__init__('{"in": {"a": {}, "b", {}}, "out": { "c": {} } }')

    def execute(self, input):
        out = {}
        a = input.get("a")
        b = input.get("b")
        c = self.multiply(a, b)
        if c is None:
            raise ValueError("Cannot multiply {} and {}".format(a, b))
        out["c"] = c
        return out

    def multiply(self, a, b):

        if not is_number(a) or not is_number(b):
            return None
        return a * b
