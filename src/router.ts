import { useEffect, useState } from 'react';

/** Hash-based routes, so the app works on GitHub Pages and offline without server rewrites. */
export type Route =
  | { name: 'map' }
  | { name: 'category'; id: string }
  | { name: 'lesson'; id: string; lesson: string }
  | { name: 'boss'; id: string }
  | { name: 'phrasebook'; id?: string }
  | { name: 'review' }
  | { name: 'avatar' }
  | { name: 'settings' };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'c':
      return parts[1] ? { name: 'category', id: parts[1] } : { name: 'map' };
    case 'l':
      return parts[1] && parts[2] ? { name: 'lesson', id: parts[1], lesson: parts[2] } : { name: 'map' };
    case 'boss':
      return parts[1] ? { name: 'boss', id: parts[1] } : { name: 'map' };
    case 'phrasebook':
      return { name: 'phrasebook', id: parts[1] };
    case 'review':
      return { name: 'review' };
    case 'avatar':
      return { name: 'avatar' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'map' };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'map':
      return '#/';
    case 'category':
      return `#/c/${r.id}`;
    case 'lesson':
      return `#/l/${r.id}/${r.lesson}`;
    case 'boss':
      return `#/boss/${r.id}`;
    case 'phrasebook':
      return r.id ? `#/phrasebook/${r.id}` : '#/phrasebook';
    case 'review':
      return '#/review';
    case 'avatar':
      return '#/avatar';
    case 'settings':
      return '#/settings';
  }
}

export function go(r: Route) {
  window.location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
