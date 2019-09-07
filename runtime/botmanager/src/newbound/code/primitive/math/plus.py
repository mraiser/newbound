from ..primitive import Primitive, is_number


class Plus(Primitive):

    def __init__(self):
        super().__init__('{"in": {"a": {}, "b", {}}, "out": { "c": {} } }')

    def execute(self, input):
        out = {}
        a = input.get("a")
        b = input.get("b")
        c = self.add(a, b)
        if c is None:
            raise ValueError("Cannot add {} and {}".format(a, b))
        out["c"] = c
        return out

    def add(self, a, b):

        if isinstance(a, (str, bytes)) or isinstance(b, (str, bytes)):
            return "{}{}".format(a, b)

        if not is_number(a) or not is_number(b):
            return None

        return a + b
