

def is_number(s):
    try:
        n = float(s)
    except ValueError:
        try:
            complex(s)
        except ValueError:
            return False
    return True


class Primitive:

    def __init__(self, code_string=""):
        self.code_string = code_string
