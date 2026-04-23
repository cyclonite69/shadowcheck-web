import { useEffect } from 'react';

export function useWigleResize({ mapContainerRef, mapRef, setMapSize, setIsMobile }: any): void {
  useEffect(() => {
    const handleResize = () => {
      if (!mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      setMapSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      mapRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [mapContainerRef, mapRef, setMapSize]);

  useEffect(() => {
    const updateViewportMode = () => {
      setIsMobile(window.innerWidth < 960);
    };
    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, [setIsMobile]);
}
