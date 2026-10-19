import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import '@itools/design-system-adapter/styles.css';
import { isLocale } from '@itools/contracts';
import { App } from './App.js';
import { parseAppPath } from './app/route.js';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root app mount element.');
}

const parsed = parseAppPath(window.location.pathname);
const documentLocale = document.documentElement.lang;
const initialLocale = isLocale(documentLocale) ? documentLocale : parsed.locale;

hydrateRoot(
  container,
  <StrictMode>
    <App initialLocale={initialLocale} initialRoute={parsed.route} />
  </StrictMode>,
);
