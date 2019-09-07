import json
import pytest

from ..primitive.math.plus import Plus


def test_add():

    plus = Plus()
    assert plus is not None

    s = json.loads('{"a": 4, "b": 2}')
    result = plus.execute(s)
    assert result["c"] == 6

    s = json.loads('{"a": 15.6, "b": 3}')
    result = plus.execute(s)
    assert result["c"] == 18.6


def test_add_strings():

    plus = Plus()

    s = json.loads('{"a": "Hello ", "b": "World!"}')
    result = plus.execute(s)
    assert result["c"] == "Hello World!"

    s = json.loads('{"a": "Hello", "b": 42}')
    result = plus.execute(s)
    assert result["c"] == "Hello42"


# def test_add_bad():
#
#     plus = Plus()
#
#     s = json.loads('{"a": true, "b": false}')
#     with pytest.raises(ValueError):
#         _ = plus.execute(s)
