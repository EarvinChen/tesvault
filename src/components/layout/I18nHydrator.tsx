'use client';

import { useEffect } from 'react';
import { hydrateLocale } from '@/lib/i18n';

// Client component that detects browser language on mount
export default function I18nHydrator() {
  useEffect(() => { hydrateLocale(); }, []);
  return null;
}
