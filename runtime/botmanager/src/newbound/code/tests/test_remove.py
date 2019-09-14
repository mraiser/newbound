import json

from ..primitive.object.remove import Remove


def test_remove():

    remove = Remove()
    assert remove is not None

    s = json.loads('{"a": [1,2,3,4], "b": 2}')
    result = remove.execute(s)
    assert result["c"] == 3

    s = json.loads('{"a": {"name": "abcde", "age": 24}, "b": "age"}')
    result = remove.execute(s)
    assert result["c"] == 24
