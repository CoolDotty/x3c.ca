import { useRef, useState, useEffect } from "react";

export function useInterpolatedValue(
  targetValue: number,
  speed: number = 0.05
): number {
  const [currentValue, setCurrentValue] = useState(targetValue);
  const currentRef = useRef(targetValue);
  const targetRef = useRef(targetValue);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    targetRef.current = targetValue;

    if (animationRef.current !== null) return;

    const animate = () => {
      const diff = targetRef.current - currentRef.current;
      if (Math.abs(diff) > 0.0001) {
        currentRef.current += diff * speed;
        setCurrentValue(currentRef.current);
        animationRef.current = requestAnimationFrame(animate);
      } else {
        currentRef.current = targetRef.current;
        setCurrentValue(targetRef.current);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [targetValue, speed]);

  return currentValue;
}
