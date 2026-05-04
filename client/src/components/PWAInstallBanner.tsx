import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone, Share, MoreVertical } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Detect device/browser
function getInstallContext() {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isChrome = /chrome/i.test(ua) && !/edg/i.test(ua);
  const isFirefox = /firefox/i.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  return { isIOS, isAndroid, isSafari, isChrome, isFirefox, isStandalone };
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [ctx, setCtx] = useState<ReturnType<typeof getInstallContext> | null>(null);
  const [installing, setInstalling] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const context = getInstallContext();
    setCtx(context);

    // Already installed — don't show anything
    if (context.isStandalone) return;

    // Don't show if permanently dismissed
    const dismissed = localStorage.getItem("pwa-banner-dismissed");
    if (dismissed === "permanent") return;

    // iOS: always show manual instructions after delay (no beforeinstallprompt on iOS)
    if (context.isIOS) {
      setTimeout(() => setShowBanner(true), 2500);
      return;
    }

    // Android/Chrome: capture the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;
      promptRef.current = prompt;
      setDeferredPrompt(prompt);
      // Show banner after short delay so page loads first
      setTimeout(() => setShowBanner(true), 1500);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Fallback: if beforeinstallprompt never fires (already installed, or browser doesn't support),
    // show manual instructions after 5 seconds on Android
    const fallbackTimer = setTimeout(() => {
      if (!promptRef.current && context.isAndroid) {
        setShowManual(true);
        setShowBanner(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // No prompt available — show manual instructions
      setShowManual(true);
      return;
    }
    try {
      setInstalling(true);
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
      }
    } catch (err) {
      console.warn("[PWA] Install prompt error:", err);
      setShowManual(true);
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
      promptRef.current = null;
    }
  };

  const handleDismiss = (permanent = false) => {
    setShowBanner(false);
    setShowManual(false);
    if (permanent) {
      localStorage.setItem("pwa-banner-dismissed", "permanent");
    }
  };

  if (!ctx || ctx.isStandalone || !showBanner) return null;

  const isIOS = ctx.isIOS;
  const hasPrompt = !!deferredPrompt;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 max-w-sm mx-auto">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-800 flex items-center justify-center">
            <img src="/icon-192x192.png" alt="BarberCtrl" className="w-full h-full object-cover" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm leading-tight">Instalar Barbearia Control</p>
            <p className="text-xs text-slate-400 mt-0.5">Acesso rápido na tela inicial</p>
          </div>
          <button
            onClick={() => handleDismiss(false)}
            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions or Install Button */}
        {!showManual && !isIOS && hasPrompt ? (
          // Android with native prompt available
          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1 gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold h-9 text-sm"
              onClick={handleInstall}
              disabled={installing}
            >
              <Download className="w-4 h-4" />
              {installing ? "Instalando..." : "Instalar agora"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-200 text-xs h-9"
              onClick={() => handleDismiss(true)}
            >
              Agora não
            </Button>
          </div>
        ) : (
          // iOS or manual instructions
          <div className="mt-3">
            {isIOS ? (
              <div className="bg-slate-800 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-300 mb-2">Como instalar no iPhone/iPad:</p>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-slate-400">
                    Toque no ícone <strong className="text-white">Compartilhar</strong> <span className="text-base">⬆️</span> na barra inferior do Safari
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-slate-400">
                    Role para baixo e toque em <strong className="text-white">"Adicionar à Tela de Início"</strong>
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-slate-400">
                    Toque em <strong className="text-white">"Adicionar"</strong> no canto superior direito
                  </p>
                </div>
              </div>
            ) : (
              // Android manual (Chrome menu)
              <div className="bg-slate-800 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-300 mb-2">Como instalar no Android:</p>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-slate-400">
                    Toque no menu <strong className="text-white">⋮</strong> (3 pontos) no canto superior direito do Chrome
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-slate-400">
                    Toque em <strong className="text-white">"Adicionar à tela inicial"</strong> ou <strong className="text-white">"Instalar app"</strong>
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-slate-400">
                    Confirme tocando em <strong className="text-white">"Instalar"</strong>
                  </p>
                </div>
              </div>
            )}
            <button
              onClick={() => handleDismiss(true)}
              className="mt-2 w-full text-xs text-slate-500 hover:text-slate-400 py-1"
            >
              Não mostrar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
