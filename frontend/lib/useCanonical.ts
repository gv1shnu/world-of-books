'use client';

import { useEffect } from 'react';

/** Sets <link rel="canonical"> on pages whose URL is only known client-side. */
export function useCanonical(href: string | null) {
  useEffect(() => {
    if (!href) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = href;
  }, [href]);
}
