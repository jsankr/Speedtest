"""CleanSpeed 3D plates, rendered with Blender (Cycles).

Builds and renders, with physically based materials and studio lighting:
  * the packet collider: a CMS-style 12-sided detector (tracker, crystal ECAL, brass HCAL,
    solenoid, red iron yoke with muon chambers) on an LHC-style ring of dipole magnets,
    with the wedge facing the camera cut away, as an image sequence of its "teardown"
    (endcaps slide out, barrel wheels part);
  * the GO button sphere for the dark and the light theme;
  * the dial bezel.
The app draws live data (packets, collisions, labels) on top of these plates. scene.json carries
the exact camera projection so the overlay lines up with the render.

Geometry constants are shared with the app's collider (index.html): keep them in sync.

  blender -b --factory-startup -P blender/render_plates.py -- --out assets/3d [--samples 48] [--width 1280]
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix

# ------------------------------------------------------------------ arguments
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
OUT = os.path.abspath(arg("--out", "assets/3d"))
SAMPLES = arg("--samples", 48)
WIDTH = arg("--width", 1280)
HEIGHT = WIDTH // 2
FRAMES = arg("--frames", 9)
ONLY = arg("--only", "all")
os.makedirs(OUT, exist_ok=True)

# ------------------------------------------------------------------ shared geometry (same numbers as the app)
RING = 4.2
WHEELS = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75]
ENDCAP = (0.75, 0.98)
BARREL = [("tracker", 0.07, 0.27), ("ecal", 0.27, 0.37), ("hcal", 0.37, 0.53), ("sol", 0.53, 0.60),
          ("yoke", 0.60, 0.68), ("muon", 0.68, 0.72), ("yoke", 0.72, 0.83), ("muon", 0.83, 0.87), ("yoke", 0.87, 1.00)]
ENDCAP_LAYERS = [("hcal", 0.10, 0.53), ("yoke", 0.53, 0.70), ("muon", 0.70, 0.74), ("yoke", 0.74, 1.00)]
SECTORS, ROT = 12, math.pi / 12

def ease(k):
    return 1 - (1 - k) ** 3

def beam_shift(z, e):
    """Teardown offset along the beam for a part centred at z (same formula as the app)."""
    if e <= 0:
        return 0.0
    if abs(z) >= ENDCAP[0] - 1e-6:
        return math.copysign(1.05 * e, z)
    return z * 0.55 * e

# App coordinates: x across, y up, z along the beam.  Blender: X across, Y along the beam, Z up.
def B(x, y, z):
    return Vector((x, z, y))

def ring_point(t):
    return B(-RING + RING * math.cos(t), 0.0, RING * math.sin(t))

# ------------------------------------------------------------------ scene helpers
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    sc.render.film_transparent = True
    sc.cycles.film_transparent_glass = True   # glass shows the page behind it, not the black world
    sc.view_settings.exposure = -0.7
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.quality = 78
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "AgX - Punchy"
    except Exception:
        pass
    world = bpy.data.worlds.new("World"); sc.world = world; world.use_nodes = True
    nt = world.node_tree; nt.nodes.clear()
    sky = nt.nodes.new("ShaderNodeTexSky")
    try:
        sky.sky_type = "NISHITA"; sky.sun_elevation = math.radians(35); sky.sun_rotation = math.radians(140)
    except Exception:
        pass
    bg = nt.nodes.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = 0.12
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"]); nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return sc

def set_in(node, names, value):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return

def material(name, color, metallic=0.0, rough=0.4, transmission=0.0, ior=1.45, coat=0.0, aniso=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    set_in(p, ["Base Color"], (*color, 1))
    set_in(p, ["Metallic"], metallic)
    set_in(p, ["Roughness"], rough)
    set_in(p, ["IOR"], ior)
    set_in(p, ["Transmission Weight", "Transmission"], transmission)
    set_in(p, ["Coat Weight", "Clearcoat"], coat)
    set_in(p, ["Coat Roughness", "Clearcoat Roughness"], 0.05)
    set_in(p, ["Anisotropic"], aniso)
    return m

MATS = {}
def mats():
    MATS.update({
        "yoke":    material("Iron yoke, red paint", (0.30, 0.018, 0.012), metallic=0.2, rough=0.45, coat=0.25),
        "muon":    material("Muon chambers, aluminium", (0.62, 0.64, 0.66), metallic=1.0, rough=0.34),
        "sol":     material("Solenoid, polished steel", (0.80, 0.82, 0.84), metallic=1.0, rough=0.16, aniso=0.5),
        "hcal":    material("HCAL, brass", (0.78, 0.52, 0.22), metallic=1.0, rough=0.28),
        "ecal":    material("ECAL, lead tungstate crystal", (0.62, 0.92, 0.86), rough=0.04, transmission=1.0, ior=2.2),
        "tracker": material("Tracker, silicon and kapton", (0.62, 0.48, 0.20), metallic=0.6, rough=0.32),
        "pipe":    material("Beam pipe, steel", (0.78, 0.80, 0.82), metallic=1.0, rough=0.2),
        "dipole":  material("Dipole cryostat, blue paint", (0.012, 0.07, 0.32), metallic=0.1, rough=0.35, coat=0.4),
        "flange":  material("Flange, steel", (0.70, 0.72, 0.74), metallic=1.0, rough=0.25),
    })

def mesh_object(name, bm, mat, bevel=0.006):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if bevel:
        mod = ob.modifiers.new("Bevel", "BEVEL"); mod.width = bevel; mod.segments = 2; mod.limit_method = "ANGLE"
    return ob

def sector_box(bm, r0, r1, a, b, y0, y1):
    """One closed sector of a 12-sided layer: across = X, up = Z, beam = Y."""
    vs = []
    for (r, t, y) in [(r0, a, y0), (r1, a, y0), (r1, b, y0), (r0, b, y0), (r0, a, y1), (r1, a, y1), (r1, b, y1), (r0, b, y1)]:
        vs.append(bm.verts.new((math.cos(t) * r, y, math.sin(t) * r)))
    for f in [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
        bm.faces.new([vs[i] for i in f])

def layer(name, mat, r0, r1, y0, y1, cut):
    bm = bmesh.new()
    for i in range(SECTORS):
        if i in cut:
            continue
        sector_box(bm, r0, r1, ROT + i / SECTORS * 2 * math.pi, ROT + (i + 1) / SECTORS * 2 * math.pi, y0, y1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return mesh_object(name, bm, MATS[mat])

def cylinder_between(name, p0, p1, radius, mat, segments=32):
    bm = bmesh.new()
    d = (p1 - p0); length = d.length
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=length)
    for f in bm.faces: f.smooth = True
    ob = mesh_object(name, bm, MATS[mat], bevel=0)
    ob.location = (p0 + p1) / 2
    ob.rotation_mode = "QUATERNION"; ob.rotation_quaternion = d.to_track_quat("Z", "Y")
    return ob

def pipe_curve(name, pts, radius):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = radius; cu.bevel_resolution = 6; cu.use_fill_caps = True
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts): sp.points[i].co = (p.x, p.y, p.z, 1)
    cu.materials.append(MATS["pipe"])
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob); ob.data.splines[0].use_smooth = True
    return ob

def torus(name, major, minor, mat, segs=96, rsegs=24, z=0.0):
    bm = bmesh.new(); rows = []
    for i in range(segs):
        u = i / segs * 2 * math.pi; row = []
        for j in range(rsegs):
            v = j / rsegs * 2 * math.pi
            r = major + minor * math.cos(v)
            row.append(bm.verts.new((r * math.cos(u), r * math.sin(u), z + minor * math.sin(v))))
        rows.append(row)
    for i in range(segs):
        for j in range(rsegs):
            a, b = rows[i][j], rows[(i + 1) % segs][j]; c, d = rows[(i + 1) % segs][(j + 1) % rsegs], rows[i][(j + 1) % rsegs]
            f = bm.faces.new((a, b, c, d)); f.smooth = True
    return mesh_object(name, bm, mat, bevel=0)

def area_light(name, loc, target, energy, size, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, "AREA"); ld.energy = energy; ld.size = size; ld.color = color
    ob = bpy.data.objects.new(name, ld); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc; ob.rotation_mode = "QUATERNION"; ob.rotation_quaternion = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y")
    return ob

def camera(loc, target, lens=50, ortho=None):
    cd = bpy.data.cameras.new("Camera"); cd.lens = lens; cd.sensor_width = 36; cd.sensor_fit = "AUTO"
    if ortho:
        cd.type = "ORTHO"; cd.ortho_scale = ortho
    ob = bpy.data.objects.new("Camera", cd); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc; ob.rotation_mode = "QUATERNION"; ob.rotation_quaternion = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y")
    bpy.context.scene.camera = ob
    return ob

def render(path, w, h):
    sc = bpy.context.scene; sc.render.resolution_x = w; sc.render.resolution_y = h
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    print("rendered", path, flush=True)

# ------------------------------------------------------------------ the collider
CAM_LOC, CAM_TARGET = (8.4, -1.6, 3.3), (0.0, 0.15, 0.0)

def cut_sectors():
    c = Vector(CAM_LOC); phi = math.atan2(c.z, c.x)
    return {i for i in range(SECTORS) if math.cos(ROT + (i + 0.5) / SECTORS * 2 * math.pi - phi) > 0.55}

def build_collider(e):
    cut = cut_sectors()
    parts = []
    for w in range(len(WHEELS) - 1):
        z0, z1 = WHEELS[w], WHEELS[w + 1]; dz = beam_shift((z0 + z1) / 2, e)
        for (m, r0, r1) in BARREL:
            parts.append(layer(f"wheel{w}-{m}-{r0}", m, r0, r1, z0 + dz, z1 + dz, cut))
    for s in (-1, 1):
        z0, z1 = (ENDCAP[0], ENDCAP[1]) if s > 0 else (-ENDCAP[1], -ENDCAP[0]); dz = beam_shift(s * 0.9, e)
        for (m, r0, r1) in ENDCAP_LAYERS:
            parts.append(layer(f"endcap{s}-{m}-{r0}", m, r0, r1, z0 + dz, z1 + dz, set()))
    # beam pipe along the ring, outside the detector; a thin section inside shows once the detector opens
    z_out = ENDCAP[1] + 1.05 * e
    t_out = math.asin(min(1.0, z_out / RING))
    for sgn in (-1, 1):
        pipe_curve(f"pipe{sgn}", [ring_point(sgn * (t_out + i * 0.02)) for i in range(48)], 0.03)
    if e > 0.05:
        cylinder_between("pipe-inner", B(0, 0, -z_out), B(0, 0, z_out), 0.025, "pipe", 16)
    # dipole magnets along the ring, clear of the opened endcaps
    for sgn in (-1, 1):
        for k in range(7):
            t0 = sgn * (0.62 + k * 0.09); t1 = t0 + sgn * 0.084
            cylinder_between(f"dipole{sgn}-{k}", ring_point(t0), ring_point(t1), 0.11, "dipole", 40)
            cylinder_between(f"flange{sgn}-{k}", ring_point(t1), ring_point(t1 + sgn * 0.004), 0.125, "flange", 40)
    # floor that only catches shadows, so the plate stays transparent
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12)
    floor = mesh_object("Shadow catcher", bm, MATS["pipe"], bevel=0); floor.location = (0, 0, -1.08)
    floor.is_shadow_catcher = True
    return parts

def collider():
    meta = None
    for f in range(FRAMES):
        reset(); mats()
        e = ease(f / (FRAMES - 1))
        build_collider(e)
        area_light("Key", (3.5, -6.0, 6.5), (0, 0, 0), 1100, 5)
        area_light("Fill", (6.5, 5.0, 1.5), (0, 0, 0), 380, 6, (0.85, 0.92, 1.0))
        area_light("Rim", (-5.0, 2.0, 5.0), (0, 0, 0), 900, 4)
        area_light("Inside", (2.2, 0.0, 1.0), (0, 0, 0), 60, 1.0, (0.7, 0.95, 1.0))  # lights the cut-away wedge
        cam = camera(CAM_LOC, CAM_TARGET, lens=50)
        bpy.context.view_layer.update()
        render(os.path.join(OUT, f"collider-{f:02d}.webp"), WIDTH, HEIGHT)
        if meta is None:
            view = cam.matrix_world.inverted()
            meta = {"width": WIDTH, "height": HEIGHT, "frames": FRAMES,
                    "view": [list(row) for row in view], "f_px": WIDTH * cam.data.lens / cam.data.sensor_width,
                    "axes": "app (x across, y up, z beam) -> blender (x, z, y)", "ring": RING,
                    "camera": {"location": list(CAM_LOC), "target": list(CAM_TARGET), "lens": cam.data.lens}}
    with open(os.path.join(OUT, "scene.json"), "w") as fh:
        json.dump(meta, fh, indent=1)

# ------------------------------------------------------------------ GO sphere (dark + light accents)
def go_spheres():
    for name, color in (("go-dark", (0.11, 0.66, 0.74)), ("go-light", (0.012, 0.18, 0.21))):
        reset()
        body = material("Sphere", color, metallic=0.0, rough=0.08, coat=1.0, ior=1.5)
        p = body.node_tree.nodes.get("Principled BSDF"); set_in(p, ["Subsurface Weight", "Subsurface"], 0.15)
        ringm = material("Seat", (0.5, 0.55, 0.58), metallic=1.0, rough=0.22)
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=48, radius=1.0)
        for f in bm.faces: f.smooth = True
        mesh_object("Sphere", bm, body, bevel=0)
        torus("Seat", 1.12, 0.09, ringm, z=0.0)
        area_light("Key", (-2.5, -2.5, 4.0), (0, 0, 0), 200, 2.0)
        area_light("Rim", (3.0, 2.5, 1.5), (0, 0, 0), 90, 3.0)
        area_light("Under", (0.0, -3.0, -2.5), (0, 0, 0), 60, 3.0, (0.7, 0.95, 1.0))
        camera((0, -0.001, 8), (0, 0, 0), ortho=2.6)
        render(os.path.join(OUT, f"{name}.webp"), 512, 512)

# ------------------------------------------------------------------ dial bezel (matches the 860×688 dial canvas)
def bezel():
    reset()
    metal = material("Bezel", (0.72, 0.75, 0.78), metallic=1.0, rough=0.24, aniso=0.6)
    glass = material("Lens", (0.9, 0.97, 1.0), rough=0.02, transmission=1.0, ior=1.45)
    # canvas: 860×688 px, dial centre at (430, 0.57·688), track radius 0.37·860; 1 world unit = 100 px
    torus("Bezel", 3.48, 0.13, metal, segs=160, rsegs=32)
    area_light("Key", (-4.0, 4.0, 6.0), (0, 0, 0), 900, 4.0)
    area_light("Rim", (5.0, -3.0, 2.0), (0, 0, 0), 400, 5.0)
    cy = 0.57 * 6.88 - 3.44   # camera sits above the dial centre so the centre lands at 57% of the height
    camera((0, cy, 10), (0, cy + 0.0001, 0), ortho=8.6)
    render(os.path.join(OUT, "bezel.webp"), 860, 688)

if __name__ == "__main__":
    if ONLY in ("all", "collider"): collider()
    if ONLY in ("all", "go"): go_spheres()
    if ONLY in ("all", "bezel"): bezel()
    print("done", OUT, flush=True)
