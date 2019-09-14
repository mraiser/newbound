import json

from ..primitive.object.put import Put


def test_put():

    put = Put()
    assert put is not None

    s = json.loads('{"a": [1,2,3,4], "b": 1, "c": 2}')
    result = put.execute(s)
    assert result["d"] == [1, 2, 1, 4]

    s = json.loads('{"a": {"name": "abcde", "age": 24}, "b": "name", "c": "fred"}')
    result = put.execute(s)
    assert result["d"]["name"] == "fred"
    assert result["d"] == {"name": "fred", "age": 24}
