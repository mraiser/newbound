import json

from ..primitive.math.int import Int


def test_int():

    integer = Int()
    assert integer is not None

    s = json.loads('{"a": 4.3}')
    result = integer.execute(s)
    assert result["b"] == 4

    s = json.loads('{"a": 21.9}')
    result = integer.execute(s)
    assert result["b"] == 21
