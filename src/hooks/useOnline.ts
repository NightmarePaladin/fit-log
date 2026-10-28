import { useNetInfo } from '@react-native-community/netinfo';

/** False only when the device reports no connection; unknown (still checking) counts as online. */
export function useOnline(): boolean {
  const { isConnected, isInternetReachable } = useNetInfo();
  return isConnected !== false && isInternetReachable !== false;
}
