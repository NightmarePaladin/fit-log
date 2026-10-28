import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { makeUnitFormat, type UnitFormat } from '../lib/units';

/** Formatting helpers bound to the signed-in user's chosen unit (weights are stored in lb). */
export function useUnits(): UnitFormat {
  const { unit } = useAuth();
  return useMemo(() => makeUnitFormat(unit), [unit]);
}
