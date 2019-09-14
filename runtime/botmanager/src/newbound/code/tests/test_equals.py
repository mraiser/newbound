import json

from ..primitive.math.equals import Equals


def test_equals():

    equals = Equals()
    assert equals is not None

    s = json.loads('{"a": 4, "b": 2}')
    result = equals.execute(s)
    assert result["c"] is False

    s = json.loads('{"a": 21.9, "b": 21.9}')
    result = equals.execute(s)
    assert result["c"] is True
