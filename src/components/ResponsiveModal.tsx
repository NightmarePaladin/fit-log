import { Modal, Pressable, View } from 'react-native';
import { useDesktop } from '../lib/layout';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** desktop dialog width */
  maxWidth?: number;
};

/**
 * Phone: a full-screen slide-up sheet, exactly as before.
 * Desktop: a centered dialog over a dimmed backdrop (click outside to close) instead of a screen-sized takeover.
 */
export function ResponsiveModal({ visible, onClose, children, maxWidth = 640 }: Props) {
  const desktop = useDesktop();
  if (!desktop) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        {children}
      </Modal>
    );
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close dialog"
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 32 }}
      >
        {/* stops clicks inside the dialog from closing it */}
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%', maxWidth, height: '88%', maxHeight: 820, overflow: 'hidden', borderRadius: 24,
            backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
          }}
        >
          <View style={{ flex: 1 }}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
