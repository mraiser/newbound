from ..primitive import Primitive, is_number


class Divide(Primitive):

    def __init__(self):
        super().__init__('{"in": {"a": {}, "b", {}}, "out": { "c": {} } }')

    def execute(self, inObj):
        out = {}
        a = inObj.get("a")
        b = inObj.get("b")
        c = self.divide(a, b)
        if c is None:
            raise ValueError("Cannot divide {} and {}".format(a, b))
        out["c"] = c
        return out

    def divide(self, a, b):

        if not is_number(a) or not is_number(b):
            return None
        return a / b
