try:
    import importlib.util
    def loadpython(module, path):
        spec = importlib.util.spec_from_file_location(module, path)
        foo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(foo)
        return foo
except:
    import imp
    def loadpython(module, path):
        return imp.load_source(module, path)
