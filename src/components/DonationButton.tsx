import React, { useState } from 'react';
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

  // Don't render if loading, disabled, or no UPI ID
  if (loading) return null;
  if (!settings?.enabled) return null;
  if (!settings?.upiId) return null;

  const appName = 'SSCQuizApp';
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(appName)}&cu=INR`;

  const handleDonateClick = () => {
    window.location.href = upiDeepLink;
  };

  const toggleQr = () => {
    setShowQr(!showQr);
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

      {/* Pay by Scan option - only show if QR is configured */}
      {settings?.qrUrl && (
        <button
          onClick={toggleQr}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Pay by Scan</span>
          {showQr ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
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
