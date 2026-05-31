import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import type { WebView as WebViewType } from "react-native-webview";

import { API_URL, WEB_APP_URL } from "./src/config";

const allowedHosts = new Set([
  new URL(WEB_APP_URL).host,
  "www.openstreetmap.org",
  "openstreetmap.org",
  "leafletjs.com",
]);

export default function App() {
  const webViewRef = useRef<WebViewType>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [canGoBack]);

  const retry = useCallback(() => {
    setHasError(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  const openInBrowser = useCallback(() => {
    Linking.openURL(WEB_APP_URL).catch(() => undefined);
  }, []);

  function onNavigationStateChange(navState: WebViewNavigation) {
    setCanGoBack(navState.canGoBack);
  }

  function shouldStartLoad(request: { url: string }) {
    try {
      const url = new URL(request.url);
      if (url.protocol === "about:" || allowedHosts.has(url.host)) return true;
      Linking.openURL(request.url).catch(() => undefined);
      return false;
    } catch {
      return true;
    }
  }

  if (hasError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.errorContainer}>
          <Text style={styles.brand}>INDUSTRIAS VENADO</Text>
          <Text style={styles.title}>No se pudo abrir la app</Text>
          <Text style={styles.body}>
            Verifica internet o que el backend publicado este activo. API configurada: {API_URL}
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={retry}>
            <Text style={styles.primaryButtonText}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={openInBrowser}>
            <Text style={styles.secondaryButtonText}>Abrir en navegador</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#c8102e" size="large" />
            <Text style={styles.loadingText}>Cargando Venado Rutas...</Text>
          </View>
        ) : null}
        <WebView
          ref={webViewRef}
          source={{ uri: WEB_APP_URL }}
          style={styles.webView}
          originWhitelist={["https://*", "http://*"]}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          pullToRefreshEnabled
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setHasError(true);
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500) {
              setLoading(false);
              setHasError(true);
            }
          }}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={shouldStartLoad}
          allowsBackForwardNavigationGestures={Platform.OS === "ios"}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3f6ff",
  },
  container: {
    flex: 1,
    backgroundColor: "#f3f6ff",
  },
  webView: {
    flex: 1,
    backgroundColor: "#f3f6ff",
  },
  loadingOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f3f6ff",
  },
  loadingText: {
    color: "#174ea6",
    fontSize: 15,
    fontWeight: "700",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f3f6ff",
  },
  brand: {
    color: "#c8102e",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 10,
  },
  body: {
    color: "#475569",
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 24,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#c8102e",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#e8f1ff",
  },
  secondaryButtonText: {
    color: "#174ea6",
    fontSize: 16,
    fontWeight: "800",
  },
});
