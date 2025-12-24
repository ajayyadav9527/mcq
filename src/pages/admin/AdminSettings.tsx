import React, { useEffect, useState, useCallback } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Setting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

export default function AdminSettings() {
  const { get, put, del } = useAdminApi();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSetting, setNewSetting] = useState({ key: '', value: '', description: '' });
  const [isAdding, setIsAdding] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await get<{ settings: Setting[] }>('admin-settings');
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
    } else if (data) {
      setSettings(data.settings);
      const initialValues: Record<string, string> = {};
      data.settings.forEach(s => {
        initialValues[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value, null, 2);
      });
      setEditedValues(initialValues);
    }
    setIsLoading(false);
  }, [get, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (key: string) => {
    setSavingKey(key);
    
    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(editedValues[key]);
    } catch {
      parsedValue = editedValues[key];
    }
    
    const { error } = await put(`admin-settings/${key}`, { value: parsedValue });
    setSavingKey(null);
    
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Setting "${key}" updated` });
      fetchSettings();
    }
  };

  const handleDelete = async (key: string) => {
    setSavingKey(key);
    const { error } = await del(`admin-settings/${key}`);
    setSavingKey(null);
    
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Setting "${key}" deleted` });
      fetchSettings();
    }
  };

  const handleAdd = async () => {
    if (!newSetting.key.trim()) {
      toast({ title: 'Error', description: 'Key is required', variant: 'destructive' });
      return;
    }
    
    setIsAdding(true);
    
    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(newSetting.value);
    } catch {
      parsedValue = newSetting.value;
    }
    
    const { error } = await put(`admin-settings/${newSetting.key}`, {
      value: parsedValue,
      description: newSetting.description || null
    });
    
    setIsAdding(false);
    
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Setting created' });
      setIsAddDialogOpen(false);
      setNewSetting({ key: '', value: '', description: '' });
      fetchSettings();
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage system configuration</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Setting
        </Button>
      </div>

      {settings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No settings configured yet. Click "Add Setting" to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {settings.map((setting) => (
            <Card key={setting.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-mono">{setting.key}</CardTitle>
                    {setting.description && (
                      <CardDescription>{setting.description}</CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(setting.key)}
                    disabled={savingKey === setting.key}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    value={editedValues[setting.key] || ''}
                    onChange={(e) => setEditedValues(v => ({ ...v, [setting.key]: e.target.value }))}
                    className="font-mono text-sm"
                    rows={3}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      Last updated: {new Date(setting.updated_at).toLocaleString()}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleSave(setting.key)}
                      disabled={savingKey === setting.key}
                    >
                      {savingKey === setting.key ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Setting Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Setting</DialogTitle>
            <DialogDescription>Create a new system setting</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="setting-key">Key</Label>
              <Input
                id="setting-key"
                placeholder="e.g., max_requests_per_minute"
                value={newSetting.key}
                onChange={(e) => setNewSetting(s => ({ ...s, key: e.target.value }))}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setting-value">Value (JSON or string)</Label>
              <Textarea
                id="setting-value"
                placeholder='e.g., 100 or {"enabled": true}'
                value={newSetting.value}
                onChange={(e) => setNewSetting(s => ({ ...s, value: e.target.value }))}
                className="font-mono"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setting-description">Description (optional)</Label>
              <Input
                id="setting-description"
                placeholder="What this setting controls"
                value={newSetting.description}
                onChange={(e) => setNewSetting(s => ({ ...s, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={isAdding || !newSetting.key.trim()}>
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
