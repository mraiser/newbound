import json

from ..primitive.object.insert import Insert


def test_insert():

    insert = Insert()
    assert insert is not None

    s = json.loads('{"a": [1,2,3,4], "b": 5}')
    result = insert.execute(s)
    assert result["c"] == [1, 2, 3, 4, 5]
