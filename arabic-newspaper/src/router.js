// Hash router. Routes matched in order; first match wins.

const routes = [];

export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, (m) => {
    keys.push(m.slice(1));
    return '([^/]+)';
  }) + '$');
  routes.push({ re, keys, handler });
}

export function navigate(path) {
  if (location.hash === '#' + path) handle();
  else location.hash = path;
}

export function start() {
  window.addEventListener('hashchange', handle);
  handle();
}

function handle() {
  const path = location.hash.slice(1) || '/';
  for (const { re, keys, handler } of routes) {
    const m = path.match(re);
    if (m) {
      const params = {};
      keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      Promise.resolve(handler(params)).catch((err) => {
        console.error('route error', err);
      });
      return;
    }
  }
  if (path !== '/') location.hash = '/';
  else if (routes.length) routes[0].handler({});
}
