import os
import sys

root = os.path.dirname(os.path.abspath('xxx.txt'))
mroot = os.path.join(root, "runtime")
mroot = os.path.join(mroot, "botmanager")
path = os.path.join(mroot, "src")

sys.path.append(path)
from newbound.robot.botmanager import BotManager

b = BotManager()
b.start(mroot, True)
