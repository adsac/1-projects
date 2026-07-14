"""Extract Overture map data for Modi'in directly from S3 (bypassing blocked STAC)."""
import os, sys, json, time
import pyarrow.dataset as ds
import pyarrow.compute as pc
from pyarrow.fs import S3FileSystem
from shapely import wkb

W, S, E, N = 34.945, 31.855, 35.045, 31.94
RELEASE = '2026-06-17.0'

proxy = os.environ.get('HTTPS_PROXY')
fs = S3FileSystem(anonymous=True, region='us-west-2',
                  proxy_options=proxy, tls_ca_file_path='/root/.ccr/ca-bundle.crt',
                  request_timeout=120, connect_timeout=30)

def grab(theme, typ, columns, out):
    path = f'overturemaps-us-west-2/release/{RELEASE}/theme={theme}/type={typ}/'
    t0 = time.time()
    d = ds.dataset(path, filesystem=fs)
    filt = (pc.field('bbox', 'xmin') < E) & (pc.field('bbox', 'xmax') > W) & \
           (pc.field('bbox', 'ymin') < N) & (pc.field('bbox', 'ymax') > S)
    cols = [c for c in columns if c in d.schema.names] + ['geometry']
    tab = d.to_table(filter=filt, columns=cols)
    feats = []
    for i in range(tab.num_rows):
        row = {c: tab[c][i].as_py() for c in cols if c != 'geometry'}
        geom = wkb.loads(tab['geometry'][i].as_py())
        feats.append({'type': 'Feature', 'properties': row,
                      'geometry': json.loads(json.dumps(geom.__geo_interface__))})
    json.dump({'type': 'FeatureCollection', 'features': feats}, open(out, 'w'))
    print(f'{theme}/{typ}: {tab.num_rows} feats in {time.time()-t0:.0f}s → {out} ({os.path.getsize(out)//1024} KB)', flush=True)

which = sys.argv[1]
if which == 'segment':
    grab('transportation', 'segment', ['id', 'subtype', 'class', 'subclass', 'names'], 'segments.geojson')
elif which == 'building':
    grab('buildings', 'building', ['height', 'num_floors', 'class', 'subtype', 'roof_shape', 'roof_color'], 'buildings.geojson')
elif which == 'water':
    grab('base', 'water', ['subtype', 'class', 'names'], 'water.geojson')
elif which == 'landuse':
    grab('base', 'land_use', ['subtype', 'class', 'names'], 'landuse.geojson')
elif which == 'landcover':
    grab('base', 'land_cover', ['subtype'], 'landcover.geojson')
