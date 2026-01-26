import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface MousePosition {
  x: number;
  y: number;
  normalizedX: number; // -1 to 1
  normalizedY: number; // -1 to 1
}

interface ParallaxContextType {
  mousePosition: MousePosition;
  isHovering: boolean;
}

const ParallaxContext = createContext<ParallaxContextType>({
  mousePosition: { x: 0, y: 0, normalizedX: 0, normalizedY: 0 },
  isHovering: false,
});

export function useParallax() {
  return useContext(ParallaxContext);
}

interface ParallaxProviderProps {
  children: ReactNode;
}

export function ParallaxProvider({ children }: ParallaxProviderProps) {
  const [mousePosition, setMousePosition] = useState<MousePosition>({
    x: 0,
    y: 0,
    normalizedX: 0,
    normalizedY: 0,
  });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    const normalizedX = (x / window.innerWidth) * 2 - 1;
    const normalizedY = (y / window.innerHeight) * 2 - 1;
    
    setMousePosition({ x, y, normalizedX, normalizedY });
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <ParallaxContext.Provider value={{ mousePosition, isHovering }}>
      {children}
    </ParallaxContext.Provider>
  );
}

interface ParallaxLayerProps {
  children: ReactNode;
  depth: number; // 0 = no movement, 1 = full movement
  className?: string;
}

export function ParallaxLayer({ children, depth, className = '' }: ParallaxLayerProps) {
  const { mousePosition, isHovering } = useParallax();
  
  const translateX = isHovering ? mousePosition.normalizedX * depth * 20 : 0;
  const translateY = isHovering ? mousePosition.normalizedY * depth * 20 : 0;
  
  return (
    <div
      className={className}
      style={{
        transform: `translate(${translateX}px, ${translateY}px)`,
        transition: 'transform 0.3s ease-out',
      }}
    >
      {children}
    </div>
  );
}
