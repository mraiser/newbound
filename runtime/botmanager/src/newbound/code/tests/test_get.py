import json

from ..primitive.object.get import Get


def test_get():

    get = Get()
    assert get is not None

    s = json.loads('{"a": [1,2,3,4], "b": 1}')
    result = get.execute(s)
    assert result["c"] == 2

    s = json.loads('{"a": {"name": "abcde", "age": 24}, "b": "name"}')
    result = get.execute(s)
    assert result["c"] == "abcde"
