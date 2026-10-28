import { Redirect } from 'expo-router';

// The OAuth deep link (fitlog://auth/callback) lands here if the OS routes it into the app;
// the code exchange itself is handled in AuthProvider, so just continue to the app.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
