"""Bake Overture GeoJSON + DEM into compact runtime binaries for the simulator.

Local frame: metres, origin at bbox centre (34.995E, 31.8975N), +x east, +z south.
Coordinates quantized to 0.5 m in int16.
Outputs: roads.bin, bld.bin, areas.bin, names.json, ground.jpg (+ copies dem.bin).
"""
import json, math, struct, hashlib, random
from shapely.geometry import shape
from shapely.ops import unary_union
from PIL import Image, ImageDraw, ImageFilter

W, S, E, N = 34.945, 31.855, 35.045, 31.94
LON0, LAT0 = (W + E) / 2, (S + N) / 2
MX = 111320 * math.cos(math.radians(LAT0))   # metres per degree lon
MZ = 110574                                   # metres per degree lat

def loc(lon, lat):
    return (lon - LON0) * MX, -(lat - LAT0) * MZ

def q(v):  # quantize to 0.5m int16
    return max(-32700, min(32700, round(v * 2)))

# ── roads ────────────────────────────────────────────────────────────────────
CLS = {  # class → (id, keep)
    'motorway': 0, 'trunk': 1, 'primary': 2, 'secondary': 3, 'tertiary': 4,
    'residential': 5, 'living_street': 5, 'unclassified': 6, 'service': 7,
    'pedestrian': 8, 'footway': 8, 'path': 8, 'steps': 9, 'cycleway': 10,
    'track': 11, 'standard_gauge': 12,
}
segs = json.load(open('segments.geojson'))['features']
names, name_idx = [], {}
def nid(nm):
    if not nm: return 65535
    if nm not in name_idx:
        name_idx[nm] = len(names); names.append(nm)
    return name_idx[nm]

out = bytearray()
count = 0
for f in segs:
    p = f['properties']
    c = CLS.get(p.get('class'))
    if c is None:
        if p.get('subtype') == 'rail': c = 12
        else: continue
    g = f['geometry']
    lines = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
    nm = (p.get('names') or {}).get('primary') if p.get('names') else None
    for line in lines:
        pts = [loc(x, y) for x, y, *_ in line]
        # thin duplicated points
        keep = [pts[0]]
        for pt in pts[1:]:
            if (pt[0]-keep[-1][0])**2 + (pt[1]-keep[-1][1])**2 > 1.2: keep.append(pt)
        if len(keep) < 2: continue
        out += struct.pack('<BHH', c, nid(nm), len(keep))
        for x, z in keep: out += struct.pack('<hh', q(x), q(z))
        count += 1
open('roads.bin', 'wb').write(struct.pack('<4sI', b'RDS1', count) + out)
print('roads.bin:', count, 'polylines,', len(out)//1024, 'KB,', len(names), 'names')
json.dump(names, open('names.json', 'w'), ensure_ascii=False)

# ── buildings ────────────────────────────────────────────────────────────────
blds = json.load(open('buildings.geojson'))['features']
# landuse polys for height context
lus = json.load(open('landuse.geojson'))['features']
villa_zones = []   # Maccabim/Re'ut & south Buchman ≈ lat<31.879 west of 34.99, or named residential
out = bytearray(); count = 0
CENTER = loc(35.0058, 31.9008)   # station = city-centre proxy for tower heuristic

def bheight(f, area, cx, cz):
    p = f['properties']
    if p.get('height'): return min(60, p['height'])
    if p.get('num_floors'): return min(60, p['num_floors'] * 3.1 + 1)
    hsh = int(hashlib.md5(json.dumps(f['geometry']['coordinates'][0][0]).encode()).hexdigest()[:6], 16)
    r = hsh / 0xffffff
    # villa belt: Maccabim & Re'ut (west-south) and small footprints anywhere
    lon = cx / MX + LON0; lat = LAT0 - cz / MZ
    villa = (lon < 34.977 and lat < 31.885)
    d2c = math.hypot(cx - CENTER[0], cz - CENTER[1])
    if villa or area < 130: return 4.5 + r * 3.5
    if area > 2500: return 12 + r * 6      # malls, schools, big-box sheds
    if area < 300: return 9.5 + r * 6      # 3-5 floors
    if d2c < 700 and 300 < area < 1100: return 26 + r * 30   # MA'AR towers
    if area < 700: return 12.5 + r * 7     # 4-6 floors
    return 15 + r * 8

for f in blds:
    g = f['geometry']
    polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    for poly in polys:
        ring = poly[0]
        sh = shape({'type': 'Polygon', 'coordinates': [ring]})
        if sh.area <= 0: continue
        sh2 = sh.simplify(0.000008)  # ≈0.8m
        ring2 = list(sh2.exterior.coords)[:-1]
        if len(ring2) < 3 or len(ring2) > 120: ring2 = ring2[:120]
        pts = [loc(x, y) for x, y in ring2]
        cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
        area = abs(sh.area) * MX * MZ  # deg² → m² approx
        h = bheight(f, area, cx, cz)
        lon = cx / MX + LON0; lat = LAT0 - cz / MZ
        villa = 1 if (lon < 34.977 and lat < 31.885) or (area < 140 and h < 8.5) else 0
        out += struct.pack('<BBH', min(255, int(h * 2)), villa, len(pts))
        for x, z in pts: out += struct.pack('<hh', q(x), q(z))
        count += 1
open('bld.bin', 'wb').write(struct.pack('<4sI', b'BLD1', count) + out)
print('bld.bin:', count, 'buildings,', len(out)//1024, 'KB')

# ── areas (water, parks, woods, pitches) ─────────────────────────────────────
AREA_KIND = {'water': 0, 'park': 1, 'forest': 2, 'orchard': 2, 'pitch': 3,
             'grass': 1, 'meadow': 1, 'playground': 4, 'school': 5,
             'construction': 6, 'shrub': 7, 'barren': 8, 'crop': 9}
out = bytearray(); count = 0
def emit_area(kind, geom):
    global out, count
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    for poly in polys:
        sh = shape({'type': 'Polygon', 'coordinates': [poly[0]]}).simplify(0.00002)
        ring = list(sh.exterior.coords)[:-1]
        if len(ring) < 3: continue
        ring = ring[:250]
        pts = [loc(x, y) for x, y in ring]
        # clip sanity: skip if fully outside
        if all(abs(x) > 4900 or abs(z) > 4900 for x, z in pts): continue
        out += struct.pack('<BH', kind, len(pts))
        for x, z in pts: out += struct.pack('<hh', q(x), q(z))
        count += 1

for f in json.load(open('water.geojson'))['features']:
    if f['geometry']['type'] not in ('Polygon', 'MultiPolygon'): continue
    if f['properties'].get('class') == 'swimming_pool': continue
    emit_area(0, f['geometry'])
for f in lus:
    k = AREA_KIND.get(f['properties'].get('class'))
    if k is None or f['geometry']['type'] not in ('Polygon', 'MultiPolygon'): continue
    emit_area(k, f['geometry'])
for f in json.load(open('landcover.geojson'))['features']:
    k = AREA_KIND.get(f['properties'].get('subtype'))
    if k is None or f['geometry']['type'] not in ('Polygon', 'MultiPolygon'): continue
    emit_area(k, f['geometry'])
open('areas.bin', 'wb').write(struct.pack('<4sI', b'ARE1', count) + out)
print('areas.bin:', count, 'polygons,', len(out)//1024, 'KB')

# ── ground albedo texture ────────────────────────────────────────────────────
T = 4096
WX = (E - W) * MX   # world width m
WZ = (N - S) * MZ
def px(x, z):
    return ((x + WX/2) / WX * T, (z + WZ/2) / WZ * T)

img = Image.new('RGB', (T, T), (176, 165, 132))       # garrigue tan
d = ImageDraw.Draw(img)
random.seed(7)
# base noise blotches
for _ in range(9000):
    x, y = random.uniform(0, T), random.uniform(0, T)
    r = random.uniform(2, 9)
    c = random.choice([(168, 158, 124), (184, 172, 138), (159, 152, 116), (172, 168, 140)])
    d.ellipse([x-r, y-r, x+r, y+r], fill=c)

def draw_geo(path, key, colmap, prop='subtype'):
    for f in json.load(open(path))['features']:
        cls = f['properties'].get(prop) if prop else key
        col = colmap.get(cls)
        if col is None: continue
        g = f['geometry']
        if g['type'] not in ('Polygon', 'MultiPolygon'): continue
        polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        for poly in polys:
            ext = [px(*loc(x, y)) for x, y in poly[0]]
            if len(ext) < 3: continue
            d.polygon(ext, fill=col)
            for hole in poly[1:]:
                hp = [px(*loc(x, y)) for x, y in hole]
                if len(hp) >= 3: d.polygon(hp, fill=(176, 165, 132))

draw_geo('landcover.geojson', None, {
    'grass': (146, 158, 106), 'shrub': (152, 152, 112), 'barren': (186, 174, 142),
    'forest': (92, 116, 74), 'crop': (188, 176, 128), 'urban': (178, 170, 150),
}, 'subtype')
draw_geo('landuse.geojson', None, {
    'park': (110, 142, 78), 'grass': (124, 150, 88), 'meadow': (136, 152, 96),
    'pitch': (96, 142, 82), 'playground': (168, 148, 110), 'school': (188, 180, 158),
    'kindergarten': (188, 180, 158), 'construction': (190, 172, 134),
    'farmland': (182, 170, 122), 'orchard': (140, 152, 92), 'pedestrian': (196, 188, 168),
    'residential': (183, 173, 148), 'cemetery': (150, 156, 120), 'military': (172, 164, 134),
}, 'class')
# roads as dark casings for the aerial look
rd = json.load(open('segments.geojson'))['features']
RW = {'motorway': 9, 'trunk': 9, 'primary': 6, 'secondary': 5, 'tertiary': 4.4,
      'residential': 3.2, 'living_street': 3.0, 'unclassified': 3.0, 'service': 1.8}
for f in rd:
    w = RW.get(f['properties'].get('class'))
    if w is None: continue
    g = f['geometry']
    lines = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
    for line in lines:
        pp = [px(*loc(x, y)) for x, y, *_ in line]
        d.line(pp, fill=(96, 94, 96), width=max(1, int(w)))
# water on top
draw_geo('water.geojson', None, {'lake': (62, 118, 150), 'pond': (62, 118, 150),
                                 'water': (62, 118, 150), 'canal': (70, 124, 150)}, 'class')
img = img.filter(ImageFilter.GaussianBlur(0.6))
img.save('ground.jpg', quality=82)
import os
print('ground.jpg:', os.path.getsize('ground.jpg')//1024, 'KB')

# key anchor positions in local metres for reference
for nm, lon, lat in [('station', 35.0058, 31.9008), ('paatei', 34.9608, 31.8936),
                     ('umdan', 34.9964, 31.8861), ('titora', 34.998, 31.909)]:
    x, z = loc(lon, lat)
    print(f'{nm}: ({x:.0f}, {z:.0f})')
# lake centroid
lake = [f for f in json.load(open('water.geojson'))['features'] if f['properties'].get('class') == 'lake']
if lake:
    sh = shape(lake[0]['geometry'])
    c = sh.centroid
    print('anava lake:', tuple(round(v) for v in loc(c.x, c.y)), 'area m2', int(sh.area*MX*MZ))
