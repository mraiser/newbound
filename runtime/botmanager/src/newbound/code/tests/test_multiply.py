import json
import pytest

from ..primitive.math.multiply import Multiply


def test_multiply():

    multiply = Multiply()
    assert multiply is not None

    s = json.loads('{"a": 4, "b": 2}')
    result = multiply.execute(s)
    assert result["c"] == 8

    s = json.loads('{"a": 15.6, "b": 3}')
    result = multiply.execute(s)
    assert result["c"] == 46.8


def test_multiply_bad():

    multiply = Multiply()
    assert multiply is not None

    s = json.loads('{"a": "apple", "b": "pie"}')
    with pytest.raises(ValueError):
        _ = multiply.execute(s)
