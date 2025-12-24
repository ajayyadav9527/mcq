import React, { useState, useCallback } from 'react';
import { useApiKeyManager, ValidationResult, ApiKeyStatus } from '@/hooks/useApiKeyManager';
import { 
  Key, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, 
  AlertCircle, Clock, Loader2, ChevronDown, ChevronUp, Zap
} from 'lucide-react';

interface BulkApiKeyManagerProps {
  onKeysChange?: (count: number) => void;
}

const BulkApiKeyManager: React.FC<BulkApiKeyManagerProps> = ({ onKeysChange }) => {
  const {
    apiKeys,
    isValidating,
    validationResults,
    addBulkKeys,
    removeKey,
    clearAllKeys,
    getAvailableKeyCount,
    getKeyStatuses,
    refreshKeyHealth
  } = useApiKeyManager();
  
  const [bulkInput, setBulkInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showKeyList, setShowKeyList] = useState(false);
  
  // Notify parent of key count changes
  React.useEffect(() => {
    onKeysChange?.(apiKeys.length);
  }, [apiKeys.length, onKeysChange]);
  
  const handleAddKeys = useCallback(async () => {
    if (!bulkInput.trim() || isValidating) return;
    
    // Parse input: support comma, newline, space separated
    const keys = bulkInput
      .split(/[,\n\s]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    if (keys.length === 0) return;
    
    await addBulkKeys(keys);
    setBulkInput('');
  }, [bulkInput, isValidating, addBulkKeys]);
  
  const handleRefreshHealth = useCallback(async () => {
    if (isValidating || apiKeys.length === 0) return;
    await refreshKeyHealth();
  }, [isValidating, apiKeys.length, refreshKeyHealth]);
  
  const getStatusIcon = (result: ValidationResult) => {
    switch (result.status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'replaced':
        return <RefreshCw className="w-4 h-4 text-warning" />;
      case 'invalid':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'limit_reached':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'duplicate':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };
  
  const getKeyStatusColor = (status: ApiKeyStatus['status']) => {
    switch (status) {
      case 'active': return 'bg-success/20 border-success text-success';
      case 'recovering': return 'bg-warning/20 border-warning text-warning';
      case 'rate-limited': return 'bg-destructive/20 border-destructive text-destructive';
      case 'inactive': return 'bg-muted border-muted-foreground/30 text-muted-foreground';
      default: return 'bg-muted border-border text-muted-foreground';
    }
  };
  
  const maskKey = (key: string) => {
    if (key.length <= 12) return key;
    return key.slice(0, 8) + '...' + key.slice(-4);
  };
  
  const keyStatuses = getKeyStatuses();
  const availableCount = getAvailableKeyCount();
  
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground">API Key Manager</h3>
            <p className="text-sm text-muted-foreground">
              {apiKeys.length === 0 
                ? 'Add Google Gemini API keys to get started'
                : `${availableCount}/${apiKeys.length} keys available`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {apiKeys.length > 0 && (
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{apiKeys.length} Keys</span>
            </div>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Bulk Input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Add API Keys (one per line or comma-separated)
            </label>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="AIzaSy...&#10;AIzaSy...&#10;AIzaSy..."
              rows={4}
              disabled={isValidating}
              className="w-full p-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter multiple keys separated by commas, spaces, or new lines. Maximum 50 keys.
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleAddKeys}
              disabled={!bulkInput.trim() || isValidating}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {isValidating ? 'Validating...' : 'Add Keys'}
            </button>
            
            {apiKeys.length > 0 && (
              <>
                <button
                  onClick={handleRefreshHealth}
                  disabled={isValidating}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
                  Refresh Health
                </button>
                
                <button
                  onClick={() => setShowKeyList(!showKeyList)}
                  className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                >
                  {showKeyList ? 'Hide Keys' : 'Show Keys'}
                </button>
                
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to remove all API keys?')) {
                      clearAllKeys();
                    }
                  }}
                  disabled={isValidating}
                  className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-lg font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </button>
              </>
            )}
          </div>
          
          {/* Validation Results */}
          {validationResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Validation Results</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {validationResults.map((result, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                      result.status === 'success' ? 'bg-success/10' :
                      result.status === 'replaced' ? 'bg-warning/10' :
                      result.status === 'invalid' ? 'bg-destructive/10' :
                      result.status === 'limit_reached' ? 'bg-warning/10' :
                      'bg-muted'
                    }`}
                  >
                    {getStatusIcon(result)}
                    <span className="font-mono text-xs text-muted-foreground">{maskKey(result.key)}</span>
                    <span className={`text-xs ${
                      result.status === 'success' ? 'text-success' :
                      result.status === 'replaced' ? 'text-warning' :
                      result.status === 'invalid' || result.status === 'limit_reached' ? 'text-destructive' :
                      'text-muted-foreground'
                    }`}>
                      {result.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Key Status Grid */}
          {showKeyList && apiKeys.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground flex items-center justify-between">
                <span>Your API Keys ({apiKeys.length})</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {availableCount} available • {apiKeys.filter(k => k.status === 'inactive').length} inactive
                </span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                {keyStatuses.map((keyStatus, idx) => (
                  <div 
                    key={idx}
                    className={`relative p-3 rounded-lg border ${getKeyStatusColor(keyStatus.status)} transition-all`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">Key {idx + 1}</span>
                      <button
                        onClick={() => removeKey(keyStatus.key)}
                        className="p-1 hover:bg-background/50 rounded transition-colors"
                        title="Remove key"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="font-mono text-[10px] opacity-75 truncate">
                      {maskKey(keyStatus.key)}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span>{keyStatus.requestCount} req</span>
                      <span className="capitalize">{keyStatus.status.replace('-', ' ')}</span>
                    </div>
                    {keyStatus.status === 'recovering' && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/50 rounded-b-lg overflow-hidden">
                        <div 
                          className="h-full bg-warning transition-all duration-500"
                          style={{ width: `${keyStatus.recoveryProgress}%` }}
                        />
                      </div>
                    )}
                    {keyStatus.status === 'active' && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Help Text */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="space-y-0.5 ml-3 list-disc">
              <li>Keys are validated against Google's API before being added</li>
              <li>Invalid or non-Gemini keys are rejected immediately</li>
              <li>Working keys can replace inactive keys automatically</li>
              <li>Rate-limited keys recover automatically after 90 seconds</li>
              <li>Keys are stored locally and persist across sessions</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkApiKeyManager;
