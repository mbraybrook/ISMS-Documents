import { useEffect } from 'react';

/**
 * Hook to set the document title for a page.
 * Automatically prefixes admin pages with "[Admin] " for easier identification.
 * 
 * @param title - The page title (without prefix)
 * @param isAdmin - Whether this is an admin page (default: false)
 * @param baseTitle - Optional base title to append (e.g., " - Paythru Trust Centre")
 */
export function usePageTitle(title: string, isAdmin = false, baseTitle?: string): void {
  useEffect(() => {
    const prefix = isAdmin ? '[Admin] ' : '';
    const suffix = baseTitle ? ` ${baseTitle}` : '';
    document.title = `${prefix}${title}${suffix}`;

    // Cleanup: restore default title when component unmounts
    return () => {
      document.title = 'Paythru Trust Centre';
    };
  }, [title, isAdmin, baseTitle]);
}

