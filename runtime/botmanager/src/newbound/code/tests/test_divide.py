import json
import pytest

from ..primitive.math.divide import Divide


def test_divide():

    divide = Divide()
    assert divide is not None

    s = json.loads('{"a": 4, "b": 2}')
    result = divide.execute(s)
    assert result["c"] == 2

    s = json.loads('{"a": 15.6, "b": 3}')
    result = divide.execute(s)
    assert result["c"] == 5.2


def test_divide_bad():

    divide = Divide()
    assert divide is not None

    s = json.loads('{"a": "15.6a", "b": 3}')
    with pytest.raises(ValueError):
        _ = divide.execute(s)
