// Captures the browser's install prompt (Android Chrome, desktop Chrome/Edge).

interface InstallEvent extends Event {
  prompt(): Promise<void>;
}

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
}

export function installPrompt() {
  return deferred;
}

export function onInstallPrompt(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
