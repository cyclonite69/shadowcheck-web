import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

interface UseMapDimensionsParams {
  setContainerHeight: Dispatch<SetStateAction<number>>;
  setMapHeight: Dispatch<SetStateAction<number>>;
}

export const useMapDimensions = ({ setContainerHeight, setMapHeight }: UseMapDimensionsParams) => {
  useEffect(() => {
    const updateHeight = () => {
      const height = window.innerHeight - 150; // More conservative padding for browser chrome
      setContainerHeight(height);
      setMapHeight(Math.floor(height * 0.75)); // Map takes 75% of available height (more space)
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [setContainerHeight, setMapHeight]);
};
