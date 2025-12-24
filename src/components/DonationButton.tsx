import React, { useState, useEffect } from 'react';
import { Heart, QrCode, ChevronDown, ChevronUp } from 'lucide-react';
import { useDonationSettings } from '@/hooks/useDonationSettings';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DonationButtonProps {
  /** When true, the pulse animation slows down (used during quiz answering) */
  pauseAnimation?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const DonationButton: React.FC<DonationButtonProps> = ({ 
  pauseAnimation = false,
  className = '' 
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

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      {/* Main Donate Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleDonateClick}
            className={`
              group flex items-center gap-2 px-4 py-2.5 
              bg-gradient-to-r from-rose-400 to-pink-400
              hover:from-rose-500 hover:to-pink-500
              text-white font-medium rounded-full
              shadow-md hover:shadow-lg
              transition-all duration-300
              ${pauseAnimation ? 'animate-none' : 'animate-pulse-slow'}
            `}
            style={{
              animation: pauseAnimation ? 'none' : 'pulse-gentle 3s ease-in-out infinite',
            }}
          >
            <Heart 
              className="w-5 h-5 fill-current transition-transform group-hover:scale-110" 
            />
            <span className="text-sm">Donate</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-foreground text-background">
          <p>Support development ❤️</p>
        </TooltipContent>
      </Tooltip>

      {/* Secondary options */}
      {settings?.qrUrl && (
        <div className="mt-2 flex items-center gap-3">
          {/* Pay by Scan - available on both mobile and desktop */}
          <button
            onClick={toggleQr}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan QR</span>
            {showQr ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Pay via App - on mobile only as secondary option when QR is open */}
          {isMobile && showQr && (
            <button
              onClick={openUpiApp}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Open App</span>
            </button>
          )}
        </div>
      )}

      {/* Inline QR Panel */}
      {showQr && settings?.qrUrl && (
        <div className="mt-3 p-3 bg-white rounded-lg shadow-lg border border-border">
          <img 
            src={settings.qrUrl} 
            alt="Donation QR Code" 
            className="w-32 h-32 object-contain mx-auto"
          />
          <p className="text-xs text-center text-muted-foreground mt-2">
            Scan to donate
          </p>
        </div>
      )}

      {/* Custom CSS for gentle pulse animation */}
      <style>{`
        @keyframes pulse-gentle {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.02);
          }
        }
      `}</style>
    </div>
  );
};

export default DonationButton;
