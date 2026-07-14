"""Multiply hillshade + hypsometric tint from the real DEM into ground.jpg."""
import struct, math
from PIL import Image

raw = open('dem.bin','rb').read()
magic, w, h, mn, mx = struct.unpack('<4sHHff', raw[:16])
vals = struct.unpack(f'<{w*h}H', raw[16:16+w*h*2])
grid = [mn + v*(mx-mn)/65535 for v in vals]

img = Image.open('ground.jpg')
T = img.size[0]
px = img.load()

# terrain sample helpers (grid row 0 = north)
def gh(i, j):
    i = max(0, min(w-1, i)); j = max(0, min(h-1, j))
    return grid[j*w + i]

# cell size in metres
cw = 9450 / (w-1); chh = 9400 / (h-1)
# sun from northwest, 40° elevation
lx, ly, lz = -0.5, 0.75, -0.5
ll = math.sqrt(lx*lx+ly*ly+lz*lz); lx, ly, lz = lx/ll, ly/ll, lz/ll

shade_img = Image.new('L', (T, T))
sp = shade_img.load()
for ty in range(T):
    j = ty / (T-1) * (h-1)
    j0 = int(j)
    for tx in range(T):
        i = tx / (T-1) * (w-1)
        i0 = int(i)
        # gradient via central differences (bilinear-ish, cheap)
        dzdx = (gh(i0+1, j0) - gh(i0-1, j0)) / (2*cw)
        dzdy = (gh(i0, j0+1) - gh(i0, j0-1)) / (2*chh)
        # normal = (-dzdx, 1, -dzdy) normalized
        nx, ny, nz = -dzdx, 1.0, -dzdy
        nl = math.sqrt(nx*nx+ny*ny+nz*nz)
        d = (nx*lx + ny*ly + nz*lz) / nl
        d = max(0.0, d)
        # remap: flat ≈ ly (0.75) → 1.0 neutral
        v = 0.62 + 0.55 * d
        sp[tx, ty] = int(max(0.45, min(1.25, v)) * 200)
for ty in range(T):
    j = ty / (T-1) * (h-1); j0 = int(j)
    for tx in range(T):
        i = tx / (T-1) * (w-1); i0 = int(i)
        s = sp[tx, ty] / 200.0
        el = (gh(i0, j0) - mn) / (mx - mn)
        r, g, b = px[tx, ty]
        # hypsometric: valleys a touch greener/darker, ridges a touch paler
        r = r * s * (0.94 + 0.12 * el)
        g = g * s * (0.97 + 0.07 * el)
        b = b * s * (0.94 + 0.08 * el)
        px[tx, ty] = (int(min(255, r)), int(min(255, g)), int(min(255, b)))
img.save('ground.jpg', quality=84)
img.thumbnail((1000,1000)); img.save('ground_shaded_preview.png')
print('shaded')
