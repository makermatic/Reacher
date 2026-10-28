import { useEffect, useRef, useState } from 'react';

/**
 * "Click twice to delete": the first click arms the button for a few seconds
 * (show `armed` to change its label), the second click runs the action.
 */
export function useArm(action: () => void, ms = 3500) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const click = () => {
    clearTimeout(timer.current);
    if (armed) {
      setArmed(false);
      action();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), ms);
  };
  return [armed, click] as const;
}
