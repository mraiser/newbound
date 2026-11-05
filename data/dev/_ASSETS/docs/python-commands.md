# Python commands

How to write, run, check and test Python commands. Requires a build with the
embedded Python runtime: `cargo build --release --features=serde_support,python_runtime`
(Python 3.10-3.14, or a free-threaded 3.13t/3.14t; select one with
`PYO3_PYTHON=python3.x`). Without `python_runtime`, Python commands run in a
`python3` subprocess per call (see the last section).

## Writing a command

A command is a function body. The platform generates the function around it
from the command's declared parameters and return type, so the parameters are
in scope as variables, and its imports go in the command's `imports` field:

    # imports
    import collections

    # body (word_stats(text: String, top: Integer) -> JSONObject)
    words = text.lower().split()
    counts = collections.Counter(words)
    return {"words": len(words), "top": [[w, n] for w, n in counts.most_common(top)]}

The generated function carries type hints from the declared types -
`def word_stats(text: "str", top: "int") -> "Mapping[str, Any]":` - and the
build writes `ndata_py.pyi` / `flowlang.pyi` stubs next to it, so editors and
type checkers check the body.

| Declared | Argument arrives as | Return may be |
|---|---|---|
| String / Integer / Float, Double / Boolean | `str` / `int` / `float` / `bool` | the same |
| JSONObject | `NDataObject` | `dict` or `NDataObject` |
| JSONArray | `NDataArray` | `list`, `tuple` or `NDataArray` |
| InputStream | `NDataBytes` | `bytes` or `NDataBytes` |
| FLAT | - | a `dict` or `NDataObject`: the whole response |
| Any | any of the above | any of the above |

A declared parameter missing from a call is an error
(`missing required parameter: x`), as for a Rust command.

## Values

`NDataObject`, `NDataArray` and `NDataBytes` are handles on the shared ndata
store: changing one changes the data Rust and every other holder see, with no
copying. They behave like the built-in types:

- `NDataObject` is a `MutableMapping` (str keys): `o["k"]`, `in`, `len`,
  iteration, `keys()/values()/items()` views, `get`, `pop`, `setdefault`,
  `update`, `copy`, `==` with any dict.
- `NDataArray` is a `MutableSequence`: indexing and slicing, `append`,
  `extend`, `insert`, `remove`, `pop`, `index`, `count`, `reverse`, `==` with
  any list.
- `to_dict()` / `to_list()` / `ndata_py.to_py(x)` give deep native copies;
  serialize with `json.dumps(x, default=ndata_py.to_py)` or `x.to_json()`.
- Create new ones with `ndata_py.NDataObject()` / `NDataArray()`.

Return values convert exactly or raise: a list stays a list, an `int` must fit
in 64 bits (`OverflowError` otherwise), and `set`, `Decimal`, `datetime`
and other types raise a `TypeError` naming an explicit conversion
(`sorted(x)`, `str(x)`, `x.isoformat()`).

## Calling other commands

    import flowlang
    total = flowlang.api.testflow.testflow.test_add(300, 120)   # any language
    total = flowlang.call("testflow", "testflow", "test_add", a=300, b=120)

Arguments may be positional (declared order) or by name and are cast to the
declared types. The result is the command's value (a flow's single output, or
all its outputs as an `NDataObject`). An unknown command raises `LookupError`,
bad arguments `TypeError`, and a failing command `flowlang.CommandError`.
Names with `-` are written with `_`. A command's own module can import
another command's: `from mylib.myctl import other_cmd`.

## Errors, output, reloading

- An exception becomes the command's error result, with the location in your
  body and the full traceback:
  `ZeroDivisionError: division by zero (mylib:myctl:cmd, body line 3)`.
- `print()` and `logging` reach the server's output as complete lines labelled
  with the command: `[py mylib:myctl:cmd] ...`. The root logger logs WARNING
  and above unless `FLOWLANG_PYTHON_LOG_LEVEL` says otherwise. In MCP mode
  (`newbound mcp`) a command's stdout goes to stderr - stdout is JSON-RPC.
- An edited command takes effect on its next call: its module is reloaded in
  place, no restart. A body that fails to load reports its error on each call
  until fixed; the old code never runs silently.

## Checking and testing

- Saving a Python command (`dev.code.upsert_command`,
  `patch_command_body`) compiles and imports it: syntax errors and missing
  packages fail the save, at the line you wrote.
- `dev.code.check_python(lib, ctl, cmd)` adds a mypy type check against the
  stubs when mypy is installed in that Python.
- `newbound pytest [args]` runs pytest inside the embedded runtime: tests call
  any command (`flowlang.api...`, Rust ones included), import command modules
  and call their functions directly, and use real `ndata_py` objects.

## Packages and the venv

If a `venv` directory exists next to `data/`, the runtime uses it: its
`sys.path` and `.pth` files (editable installs) are applied once, at startup.
Install a command's third-party packages there (`venv/bin/pip install ...`),
with a venv made by the same Python the runtime embeds. The library package
root (`<lib root>/src`) is on `sys.path`; the working directory is not.

## Concurrency

With a standard CPython, Python commands share the GIL: CPU-bound commands run
one at a time (the lock is released while `flowlang.call` runs another
command). Built against a free-threaded CPython (3.13t/3.14t), Python commands
run in parallel; an extension module without free-threading support re-enables
the GIL when imported.

## Without the embedded runtime

A build without `python_runtime` runs each call in a `python3` subprocess (the
venv's, if present) with the same results, conversions and error reports.
Data crosses by value as JSON: arguments arrive as plain `dict`/`list`, bytes
as ndata's hex string, `ndata_py` is absent, and `flowlang.call` raises.
