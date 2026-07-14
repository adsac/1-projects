"""Fetch terrarium elevation tiles (z13) for the Modi'in bbox and export a Float32 grid."""
import math, io, json, struct, urllib.request, os

W, S, E, N = 34.945, 31.855, 35.045, 31.94
Z = 13

def tile(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y

x0f, y1f = tile(W, S, Z); x1f, y0f = tile(E, N, Z)
x0, x1 = int(x0f), int(x1f); y0, y1 = int(y0f), int(y1f)
print('tiles x', x0, x1, 'y', y0, y1, '→', (x1-x0+1)*(y1-y0+1), 'tiles')

from PIL import Image
tw = (x1 - x0 + 1) * 256; th = (y1 - y0 + 1) * 256
mosaic = Image.new('RGB', (tw, th))
for tx in range(x0, x1 + 1):
    for ty in range(y0, y1 + 1):
        url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png'
        data = urllib.request.urlopen(url, timeout=30).read()
        img = Image.open(io.BytesIO(data)).convert('RGB')
        mosaic.paste(img, ((tx - x0) * 256, (ty - y0) * 256))
        print('got', tx, ty)

# decode terrarium: h = R*256 + G + B/256 - 32768
px = mosaic.load()
# crop to exact bbox in pixel space
fx0 = (x0f - x0) * 256; fx1 = (x1f - x0) * 256
fy0 = (y0f - y0) * 256; fy1 = (y1f - y0) * 256
GW, GH = 400, 340   # output grid resolution (≈ 22m/px E-W)
import array
grid = array.array('f', [0.0]) * 0
vals = array.array('f')
for j in range(GH):
    for i in range(GW):
        pxx = fx0 + (fx1 - fx0) * i / (GW - 1)
        pyy = fy0 + (fy1 - fy0) * j / (GH - 1)
        xi, yi = int(pxx), int(pyy)
        xi = min(max(xi, 0), tw - 2); yi = min(max(yi, 0), th - 2)
        u, v = pxx - xi, pyy - yi
        def h(a, b):
            r, g, bb = px[a, b]
            return r * 256 + g + bb / 256 - 32768
        val = (h(xi, yi) * (1-u) + h(xi+1, yi) * u) * (1-v) + (h(xi, yi+1) * (1-u) + h(xi+1, yi+1) * u) * v
        vals.append(val)

mn, mx = min(vals), max(vals)
print('elevation range', round(mn,1), '→', round(mx,1))
with open('dem.bin', 'wb') as f:
    f.write(struct.pack('<4sHHff', b'DEM1', GW, GH, mn, mx))
    for v in vals:
        f.write(struct.pack('<H', int((v - mn) / (mx - mn) * 65535)))
json.dump({'w': GW, 'h': GH, 'west': W, 'south': S, 'east': E, 'north': N, 'min': mn, 'max': mx}, open('dem.json', 'w'))
print('wrote dem.bin', os.path.getsize('dem.bin'), 'bytes')
