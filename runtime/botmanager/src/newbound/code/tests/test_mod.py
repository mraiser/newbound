import json
import pytest

from ..primitive.math.mod import Mod


def test_mod():

    mod = Mod()
    assert mod is not None

    s = json.loads('{"a": 4, "b": 2}')
    result = mod.execute(s)
    assert result["c"] == 0

    s = json.loads('{"a": 9, "b": 3}')
    result = mod.execute(s)
    assert result["c"] == 0

    s = json.loads('{"a": 21, "b": 5}')
    result = mod.execute(s)
    assert result["c"] == 1


def test_mod_bad():

    mod = Mod()
    assert mod is not None

    s = json.loads('{"a": "apple", "b": "pie"}')
    with pytest.raises(ValueError):
        _ = mod.execute(s)
