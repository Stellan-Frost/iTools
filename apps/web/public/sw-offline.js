const OFFLINE_MESSAGES = {
  'zh-CN': {
    home: ['首页暂不可用', '首页缓存尚未准备好，请联网后重试。'],
    tasks: ['任务页离线不可用', '任务记录需要连接服务器，联网后即可查看。'],
    admin: ['管理页离线不可用', '管理功能需要连接服务器，联网后即可使用。'],
    tool: ['工具离线不可用', '该工具页面无法离线打开，请联网后重试。'],
  },
  en: {
    home: [
      'Home is unavailable offline',
      'The home page is not cached yet. Reconnect and try again.',
    ],
    tasks: [
      'Tasks are unavailable offline',
      'Task records require a server connection.',
    ],
    admin: [
      'Admin is unavailable offline',
      'Admin features require a server connection.',
    ],
    tool: [
      'Tool is unavailable offline',
      'This tool page cannot open offline. Reconnect and try again.',
    ],
  },
};

function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function isEngineRequest(pathname) {
  return (
    pathname.startsWith('/engines/') || pathname.startsWith('/assets/engines/')
  );
}

function isNetworkOnlyPath(pathname) {
  return (
    isApiPath(pathname) ||
    pathname === '/sw.js' ||
    pathname === '/sw-core.js' ||
    pathname === '/sw-offline.js' ||
    pathname === '/sw-manifest.json'
  );
}

function isStaticRequest(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/brand-icon/') ||
    pathname === '/index.html' ||
    pathname === '/manifest.webmanifest' ||
    isEngineRequest(pathname)
  );
}

self.__ITOOLS_OFFLINE__ = { isNetworkOnlyPath, isStaticRequest };

function offlinePage(kind, locale, status = 503) {
  const language = locale === 'en' ? 'en' : 'zh-CN';
  const [title, message] = OFFLINE_MESSAGES[language][kind];
  const reconnect =
    language === 'en'
      ? 'Reconnect to the internet and try again.'
      : '恢复联网后请重试。';
  const body = `<!doctype html><html lang="${language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body><main><h1>${title}</h1><p>${message}</p><p>${reconnect}</p></main></body></html>`;
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Offline-Status': 'unavailable',
    },
  });
}

async function offlineNavigationResponse(url) {
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const segments = pathname.split('/').filter(Boolean);
  const locale =
    segments[0] === 'zh-CN' || segments[0] === 'en' ? segments[0] : '';
  const route = locale ? segments[1] : segments[0];

  if (!route && (locale || pathname === '/')) {
    const homePath = locale ? `/${locale}` : '/zh-CN';
    const requestUrl = new URL(homePath, self.location.origin);
    const core = self.__ITOOLS_CORE__;
    const names = await core.repairFallbackNames();
    for (const name of [
      ...names.filter((value) => value.startsWith('itools-precache-')),
      core.precacheName,
    ]) {
      const cached = await (await caches.open(name)).match(requestUrl);
      if (cached) return cached;
    }
    return offlinePage('home', locale);
  }
  if (route === 'tasks') {
    return offlinePage('tasks', locale);
  }
  if (route === 'admin') {
    return offlinePage('admin', locale);
  }
  return offlinePage('tool', locale);
}

async function cacheFirst(request, pathname) {
  const core = self.__ITOOLS_CORE__;
  const targetName = isEngineRequest(pathname)
    ? core.enginesName
    : core.runtimeName;
  const backups = await core.repairFallbackNames();
  const currentNames =
    backups.length > 0
      ? backups
      : [core.precacheName, core.enginesName, core.runtimeName];
  for (const name of currentNames) {
    try {
      const cached = await (await caches.open(name)).match(request);
      if (cached) return cached;
    } catch {
      // A cache read failure should fall through to the network.
    }
  }

  try {
    const response = await fetch(request);
    if (backups.length === 0 && response.ok && response.type !== 'opaque') {
      try {
        await (await caches.open(targetName)).put(request, response.clone());
      } catch {
        // Keep the network response usable when storage is full or unavailable.
      }
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNetworkOnlyPath(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => offlineNavigationResponse(url)),
    );
    return;
  }
  if (isStaticRequest(url.pathname)) {
    event.respondWith(cacheFirst(request, url.pathname));
  }
});
