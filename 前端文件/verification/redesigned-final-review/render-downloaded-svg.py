"""Offline vector conversion only; not browser automation.
Requires CairoSVG and installed Noto Sans CJK SC. Does not change SVG bytes.
"""
import os
from pathlib import Path
HERE=Path(__file__).resolve().parent
os.environ['FONTCONFIG_FILE']=str(HERE/'fontconfig-offline-preview.conf')
import cairosvg
cairosvg.svg2png(url=str(HERE/'downloaded-design-sheet.svg'),write_to=str(HERE/'downloaded-design-sheet.png'))
