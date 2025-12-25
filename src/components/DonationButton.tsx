import React, { useState, useEffect } from 'react';
import { Heart, QrCode, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useDonationSettings } from '@/hooks/useDonationSettings';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DonationButtonProps {
  /** When true, the pulse animation slows down (used during quiz answering) */
  pauseAnimation?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for embedding in headers */
  compact?: boolean;
}

const DonationButton: React.FC<DonationButtonProps> = ({ 
  pauseAnimation = false,
  className = '',
  compact = false
}) => {
  const { settings, loading } = useDonationSettings();
  const [showQr, setShowQr] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      setIsMobile(mobileRegex.test(userAgent.toLowerCase()));
    };
    checkMobile();
  }, []);

  // Don't render if loading, disabled, or no UPI ID
  if (loading) return null;
  if (!settings?.enabled) return null;
  if (!settings?.upiId) return null;

  const appName = 'SSCQuizApp';
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(appName)}&cu=INR`;

  const handleDonateClick = () => {
    if (isMobile) {
      // Mobile: Open UPI app directly
      window.location.href = upiDeepLink;
    } else {
      // Desktop: Toggle QR code
      if (settings?.qrUrl) {
        setShowQr(!showQr);
      }
    }
  };

  const toggleQr = () => {
    setShowQr(!showQr);
  };

  const openUpiApp = () => {
    window.location.href = upiDeepLink;
  };

  // Compact version for quiz header
  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleDonateClick}
              className="
                relative group flex items-center gap-1.5 px-3 py-1.5
                bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400
                hover:from-amber-500 hover:via-orange-500 hover:to-rose-500
                text-white font-semibold rounded-full
                shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50
                transition-all duration-300 transform hover:scale-105
                border border-white/20
              "
            >
              <Heart className="w-4 h-4 fill-current animate-pulse" />
              <span className="text-xs sm:text-sm">Donate</span>
              <Sparkles className="w-3 h-3 opacity-80" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-foreground text-background">
            <p>Support our development ❤️</p>
          </TooltipContent>
        </Tooltip>

        {/* QR Popup for compact mode */}
        {showQr && settings?.qrUrl && (
          <div className="absolute top-full right-0 mt-2 z-50 p-4 bg-white rounded-xl shadow-2xl border border-border animate-in fade-in slide-in-from-top-2">
            <img 
              src={settings.qrUrl} 
              alt="Donation QR Code" 
              className="w-32 h-32 object-contain mx-auto"
            />
            <p className="text-xs text-center text-muted-foreground mt-2">
              Scan to donate
            </p>
            {isMobile && (
              <button
                onClick={openUpiApp}
                className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors py-1"
              >
                <Heart className="w-3 h-3" />
                <span>Open App</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full version
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      {/* Main Donate Button - Enhanced styling */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleDonateClick}
            className={`
              group relative flex items-center gap-2.5 px-6 py-3 
              bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500
              hover:from-amber-500 hover:via-orange-500 hover:to-rose-600
              text-white font-bold rounded-full
              shadow-xl shadow-orange-500/40 hover:shadow-orange-500/60
              transition-all duration-300 transform hover:scale-105
              border-2 border-white/30
              overflow-hidden
            `}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            
            <Heart 
              className="w-5 h-5 fill-current animate-pulse relative z-10" 
            />
            <span className="text-base relative z-10">Support Us</span>
            <Sparkles className="w-4 h-4 relative z-10 opacity-90" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-foreground text-background">
          <p>Your support keeps us going! ❤️</p>
        </TooltipContent>
      </Tooltip>

      {/* Secondary options */}
      {settings?.qrUrl && (
        <div className="mt-3 flex items-center gap-3">
          {/* Pay by Scan - available on both mobile and desktop */}
          <button
            onClick={toggleQr}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-muted/50"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR</span>
            {showQr ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Pay via App - on mobile only as secondary option when QR is open */}
          {isMobile && showQr && (
            <button
              onClick={openUpiApp}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-full hover:bg-primary/10"
            >
              <Heart className="w-4 h-4" />
              <span>Open App</span>
            </button>
          )}
        </div>
      )}

      {/* Inline QR Panel - Enhanced */}
      {showQr && settings?.qrUrl && (
        <div className="mt-4 p-5 bg-gradient-to-br from-white to-orange-50 rounded-2xl shadow-xl border border-orange-200/50">
          <img 
            src={settings.qrUrl} 
            alt="Donation QR Code" 
            className="w-36 h-36 object-contain mx-auto rounded-lg"
          />
          <p className="text-sm text-center text-muted-foreground mt-3 font-medium">
            Scan to donate via UPI
          </p>
        </div>
      )}
    </div>
  );
};

export default DonationButton;