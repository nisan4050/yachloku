import { useEffect, useState } from 'react';

/**
 * Detects whether the on-screen keyboard is likely open, via the
 * VisualViewport shrinking significantly relative to the layout viewport.
 * Used to hide fixed-position chrome (bottom nav) that would otherwise
 * overlap the keyboard or floating menus opened near the bottom of the screen.
 */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const initialHeight = window.innerHeight;

    const handleResize = () => {
      const heightDiff = initialHeight - vv.height;
      setVisible(heightDiff > 150);
    };

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  return visible;
}
