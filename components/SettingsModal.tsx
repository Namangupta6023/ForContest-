'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Key, Check, X, Sparkles, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  paypalClientId: string;
  paypalSecret: string;
  geminiKey: string;
  onSaveSettings: (clientId: string, secret: string, geminiKey: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, paypalClientId, paypalSecret, geminiKey, onSaveSettings,
}) => {
  const [clientId, setClientId] = useState(paypalClientId);
  const [secret, setSecret] = useState(paypalSecret);
  const [gemKey, setGemKey] = useState(geminiKey);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(clientId, secret, gemKey);
    setIsSaved(true);
    setTimeout(() => { setIsSaved(false); onClose(); }, 800);
  };

  const handleUseDemoDefaults = () => {
    // Credentials are configured server-side via environment variables (.env file).
    // This button is kept for UI demonstration purposes — configure your .env to enable live API calls.
    setClientId('');
    setSecret('');
    setGemKey('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full p-6 rounded-2xl bg-white shadow-modal space-y-5"
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-700" aria-hidden="true" />
            <h3 id="settings-modal-title" className="text-sm font-bold text-gray-900">API Credentials & Sandbox Config</h3>
          </div>
          <button onClick={onClose} aria-label="Close settings" className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4" noValidate>
          <div>
            <label htmlFor="paypal-client-id" className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Key className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
              <span>PayPal Sandbox Client ID</span>
            </label>
            <input
              id="paypal-client-id"
              type="text"
              placeholder="e.g. A21AAJ..."
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-50"
            />
            <p className="text-[10px] text-gray-400 mt-1">From developer.paypal.com dashboard Apps &amp; Credentials</p>
          </div>

          <div>
            <label htmlFor="paypal-secret" className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Key className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
              <span>PayPal Sandbox Secret</span>
            </label>
            <input
              id="paypal-secret"
              type="password"
              placeholder="••••••••••••••••••••••••••••••••"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-50"
            />
          </div>

          <div>
            <label htmlFor="gemini-key" className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" aria-hidden="true" />
              <span>Google Gemini API Key</span>
            </label>
            <input
              id="gemini-key"
              type="password"
              placeholder="AIzaSy..."
              value={gemKey}
              onChange={(e) => setGemKey(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono text-gray-800 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-50"
            />
            <p className="text-[10px] text-gray-400 mt-1">Optional — App works with smart built-in heuristic reasoning out-of-the-box!</p>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-gray-100">
            <button
              type="button"
              onClick={handleUseDemoDefaults}
              className="text-xs font-semibold text-brand-500 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Auto-Fill Sandbox Defaults
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-600 rounded-lg">Cancel</button>
              <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-xs font-bold text-white rounded-lg shadow-sm">
                {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{isSaved ? 'Saved!' : 'Save Config'}</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
