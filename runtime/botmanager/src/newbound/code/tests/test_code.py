
from ..code import Code


def test_code_init():
    code = Code(code=None, lib="runtime")
    assert code is not None


def test_code_evaluate():

    data = {"cons": [
                {"src": [-1, "a"], "dest": [0, "a"]},
                {"src": [-1, "b"], "dest": [0, "b"]},
                {"src": [1, "a"], "dest": [3, "a"]},
                {"src": [0, "c"], "dest": [2, "a"]},
                {"src": [2, "b"], "dest": [3, "b"]},
                {"src": [3, "c"], "dest": [-2, "a"]}
            ],
            "cmds": [
                {"name": "+", "in": {"a": {}, "b": {}}, "type": "primitive"},
                {"name": "3", "in": {}, "type": "constant", "out": {"a": 3}, "done": True},
                {"name": "int", "in": {"a":  {}}, "type": "primitive"},
                {"name": "equals", "in": {"a": {}, "b": {}}, "type": "primitive"}]
    }

    args = {"a": -2, "b": 4}
    results = Code(code=data, lib="runtime").execute(args)
    assert results == {"a": False}


