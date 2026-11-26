"""Offline standard librsvg + Cairo/Pango conversion; NOT browser rendering.
No source XML modifications. Uses installed Fontconfig fallback (Noto Sans/CJK SC).
"""
from pathlib import Path
import ctypes as C, ctypes.util, json, hashlib
rsvg=C.CDLL(ctypes.util.find_library('rsvg-2'));cairo=C.CDLL(ctypes.util.find_library('cairo'));gobject=C.CDLL(ctypes.util.find_library('gobject-2.0'))
class Dimensions(C.Structure):_fields_=[('width',C.c_int),('height',C.c_int),('em',C.c_double),('ex',C.c_double)]
rsvg.rsvg_handle_new_from_file.argtypes=[C.c_char_p,C.POINTER(C.c_void_p)];rsvg.rsvg_handle_new_from_file.restype=C.c_void_p
rsvg.rsvg_handle_get_dimensions.argtypes=[C.c_void_p,C.POINTER(Dimensions)]
rsvg.rsvg_handle_render_cairo.argtypes=[C.c_void_p,C.c_void_p];rsvg.rsvg_handle_render_cairo.restype=C.c_int
gobject.g_object_unref.argtypes=[C.c_void_p]
cairo.cairo_image_surface_create.argtypes=[C.c_int,C.c_int,C.c_int];cairo.cairo_image_surface_create.restype=C.c_void_p
cairo.cairo_create.argtypes=[C.c_void_p];cairo.cairo_create.restype=C.c_void_p
cairo.cairo_surface_write_to_png.argtypes=[C.c_void_p,C.c_char_p];cairo.cairo_surface_write_to_png.restype=C.c_int
cairo.cairo_destroy.argtypes=[C.c_void_p];cairo.cairo_surface_destroy.argtypes=[C.c_void_p]
out=Path('verification/panorama-framing');out.mkdir(parents=True,exist_ok=True);records=[]
for number in [6,8]:
 source=Path(f'/home/box/Downloads/夏遮冬透-建筑表皮光热设计单 ({number}).svg')
 if not source.exists():records.append({'number':number,'exists':False});continue
 before=hashlib.sha256(source.read_bytes()).hexdigest();error=C.c_void_p();handle=rsvg.rsvg_handle_new_from_file(str(source).encode(),C.byref(error));assert handle,'librsvg failed to open source'
 dims=Dimensions();rsvg.rsvg_handle_get_dimensions(handle,C.byref(dims));surface=cairo.cairo_image_surface_create(0,dims.width,dims.height);context=cairo.cairo_create(surface)
 assert rsvg.rsvg_handle_render_cairo(handle,context),'librsvg conversion failed'
 dest=out/f'download-{number}-librsvg-full.png';assert cairo.cairo_surface_write_to_png(surface,str(dest).encode())==0
 cairo.cairo_destroy(context);cairo.cairo_surface_destroy(surface);gobject.g_object_unref(handle)
 assert before==hashlib.sha256(source.read_bytes()).hexdigest()
 records.append({'source':str(source),'source_sha256':before,'source_unchanged':True,'png':str(dest),'width':dims.width,'height':dims.height,'conversion':'installed librsvg + Cairo/Pango; NOT browser render or screenshot','font_resolution':'Fontconfig sans-serif=Noto Sans, zh-cn fallback=Noto Sans CJK SC; original font-family retained','browser_visual_note':'(6) upper half browser verified only; (8) download date verified; these PNGs are offline vector conversion, not browser proof'})
Path('integration-notes/panorama-framing/svg-conversion.json').write_text(json.dumps(records,ensure_ascii=False,indent=2));print(json.dumps(records,ensure_ascii=False,indent=2))
