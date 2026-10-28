import { Alert, Platform } from 'react-native';

export type DialogButton = { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void };

/**
 * Alert.alert is a no-op on web, so fall back to window.confirm there.
 * On web the LAST non-cancel button is the "OK" action; Cancel does nothing.
 */
export function showDialog(title: string, message: string | undefined, buttons: DialogButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const action = [...buttons].reverse().find((b) => b.style !== 'cancel');
  const ok = window.confirm(message ? `${title}\n\n${message}` : title);
  if (ok) action?.onPress?.();
}
