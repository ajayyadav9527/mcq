import React, { useEffect, useState, useCallback } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Heart, QrCode, Link } from 'lucide-react';

export default function AdminDonations() {
  const { get, put } = useAdminApi();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [enabled, setEnabled] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await get<{ settings: Array<{ key: string; value: unknown }> }>('admin-settings');
    
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
    } else if (data?.settings) {
      for (const setting of data.settings) {
        if (setting.key === 'donation_enabled') {
          setEnabled(setting.value === true || setting.value === 'true');
        } else if (setting.key === 'donation_upi_id') {
          setUpiId(typeof setting.value === 'string' ? setting.value : '');
        } else if (setting.key === 'donation_qr_url') {
          setQrUrl(typeof setting.value === 'string' ? setting.value : '');
        }
      }
    }
    setIsLoading(false);
  }, [get, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);

    // Save all three settings
    const savePromises = [
      put('admin-settings/donation_enabled', { 
        value: enabled,
        description: 'Enable or disable the donation button globally'
      }),
      put('admin-settings/donation_upi_id', { 
        value: upiId.trim(),
        description: 'UPI ID for receiving donations'
      }),
      put('admin-settings/donation_qr_url', { 
        value: qrUrl.trim(),
        description: 'URL to the QR code image for donations'
      }),
    ];

    const results = await Promise.all(savePromises);
    const hasError = results.some(r => r.error);

    setIsSaving(false);

    if (hasError) {
      toast({ title: 'Error', description: 'Failed to save some settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Donation settings saved successfully' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Heart className="h-8 w-8 text-rose-500" />
          Donation Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure the donation button that appears on Home and Quiz pages
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Donation Button Configuration</CardTitle>
          <CardDescription>
            Changes apply instantly across all pages without reload
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
            <div className="space-y-0.5">
              <Label htmlFor="donation-enabled" className="text-base font-medium">
                Enable Donation Button
              </Label>
              <p className="text-sm text-muted-foreground">
                Show the donation button on Home and Quiz pages
              </p>
            </div>
            <Switch
              id="donation-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* UPI ID */}
          <div className="space-y-2">
            <Label htmlFor="upi-id" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              UPI ID
            </Label>
            <Input
              id="upi-id"
              placeholder="example@upi"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The UPI ID where donations will be sent. Required for the button to appear.
            </p>
          </div>

          {/* QR Code URL */}
          <div className="space-y-2">
            <Label htmlFor="qr-url" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Code Image URL
            </Label>
            <Input
              id="qr-url"
              placeholder="https://example.com/qr-code.png"
              value={qrUrl}
              onChange={(e) => setQrUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              URL to a QR code image. If not set, the "Pay by Scan" option will be hidden.
            </p>
            
            {/* QR Preview */}
            {qrUrl && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-border inline-block">
                <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                <img 
                  src={qrUrl} 
                  alt="QR Code Preview" 
                  className="w-32 h-32 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-border">
            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Button Preview</CardTitle>
          <CardDescription>
            This is how the donation button will appear to users
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          {enabled && upiId ? (
            <div className="text-center">
              <button
                className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-400 to-pink-400 text-white font-medium rounded-full shadow-md"
                style={{
                  animation: 'pulse-gentle 3s ease-in-out infinite',
                }}
              >
                <Heart className="w-5 h-5 fill-current" />
                <span className="text-sm">Donate</span>
              </button>
              {qrUrl && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <QrCode className="w-3 h-3" />
                  Pay by Scan
                </p>
              )}
              <style>{`
                @keyframes pulse-gentle {
                  0%, 100% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.9; transform: scale(1.02); }
                }
              `}</style>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <Heart className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {!enabled ? 'Donation button is disabled' : 'Add a UPI ID to enable the button'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
