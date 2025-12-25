import React, { useState, useEffect } from 'react';
import { Heart, QrCode, X } from 'lucide-react';
import { useDonationSettings } from '@/hooks/useDonationSettings';

interface DonationButtonProps {
  /** Button size variant */
  variant?: 'default' | 'compact' | 'floating';
  /** Additional CSS classes */
  className?: string;
}

const DonationButton: React.FC<DonationButtonProps> = ({ 
  variant = 'default',
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
      window.location.href = upiDeepLink;
    } else {
      if (settings?.qrUrl) {
        setShowQr(!showQr);
      }
    }
  };

  // Floating variant - fixed position button
  if (variant === 'floating') {
    return (
      <>
        <button
          onClick={handleDonateClick}
          className={`
            fixed bottom-6 right-6 z-50
            flex items-center justify-center
            w-14 h-14 rounded-full
            bg-gradient-to-br from-rose-500 to-pink-600
            text-white shadow-lg
            hover:shadow-xl hover:scale-105
            transition-all duration-300
            group
            ${className}
          `}
          aria-label="Donate"
        >
          <Heart className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
        </button>
        
        {/* QR Modal */}
        {showQr && settings?.qrUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card rounded-2xl shadow-2xl border border-border p-6 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                  Support Us
                </h3>
                <button 
                  onClick={() => setShowQr(false)}
                  className="p-1.5 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="bg-white rounded-xl p-4 mb-4">
                <img 
                  src={settings.qrUrl} 
                  alt="Donation QR Code" 
                  className="w-full max-w-[200px] mx-auto aspect-square object-contain"
                />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Scan with any UPI app to donate
              </p>
              {isMobile && (
                <button
                  onClick={() => window.location.href = upiDeepLink}
                  className="w-full mt-4 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium hover:opacity-90 transition-opacity"
                >
                  Open UPI App
                </button>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`inline-flex flex-col items-center ${className}`}>
        <button
          onClick={handleDonateClick}
          className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-500/10 to-pink-500/10 border border-rose-500/20 hover:border-rose-500/40 hover:from-rose-500/20 hover:to-pink-500/20 transition-all duration-300"
        >
          <Heart className="w-4 h-4 text-rose-500 fill-rose-500/50 group-hover:fill-rose-500 transition-colors" />
          <span className="text-sm font-medium text-rose-600">Donate</span>
        </button>
        
        {showQr && settings?.qrUrl && (
          <div className="mt-3 p-3 bg-card rounded-xl shadow-lg border border-border">
            <img 
              src={settings.qrUrl} 
              alt="QR Code" 
              className="w-28 h-28 object-contain mx-auto"
            />
            <p className="text-xs text-center text-muted-foreground mt-2">
              Scan to donate
            </p>
          </div>
        )}
      </div>
    );
  }

  // Default variant - elegant card style
  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500/5 via-pink-500/5 to-purple-500/5 border border-rose-500/10 p-6">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-500/10 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Support This Project</h3>
              <p className="text-sm text-muted-foreground">Help us keep it free</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDonateClick}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/30 hover:scale-[1.02] transition-all duration-300"
            >
              <Heart className="w-4 h-4 fill-current" />
              {isMobile ? 'Donate via UPI' : 'Donate Now'}
            </button>
            
            {settings?.qrUrl && !isMobile && (
              <button
                onClick={() => setShowQr(!showQr)}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-muted transition-colors"
              >
                <QrCode className="w-4 h-4" />
                {showQr ? 'Hide QR' : 'Show QR'}
              </button>
            )}
          </div>
          
          {/* QR Code */}
          {showQr && settings?.qrUrl && (
            <div className="mt-4 p-4 bg-white rounded-xl border border-border">
              <img 
                src={settings.qrUrl} 
                alt="Donation QR Code" 
                className="w-36 h-36 object-contain mx-auto"
              />
              <p className="text-xs text-center text-muted-foreground mt-2">
                Scan with any UPI app
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DonationButton;
