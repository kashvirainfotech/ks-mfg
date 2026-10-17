import React, { useState } from 'react';
import {
  Check,
  Monitor,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  X,
} from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../lib/apiClient';
import type { ThemeColor, ThemeMode } from '../../types/auth.types';

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_OPTIONS: {
  id: ThemeColor;
  label: string;
  swatch: string;
  desc: string;
}[] = [
  {
    id: 'indigo',
    label: 'Indigo Precision',
    swatch: '#4f46e5',
    desc: 'Default industrial ERP palette',
  },
  {
    id: 'blue',
    label: 'Cobalt Engineering',
    swatch: '#2563eb',
    desc: 'High-clarity technical blue',
  },
  {
    id: 'emerald',
    label: 'Emerald Shopfloor',
    swatch: '#059669',
    desc: 'Balanced manufacturing green',
  },
  {
    id: 'violet',
    label: 'Royal Automation',
    swatch: '#7c3aed',
    desc: 'Modern executive purple',
  },
  {
    id: 'amber',
    label: 'Amber Foundry',
    swatch: '#d97706',
    desc: 'Warm heavy-industry gold',
  },
  {
    id: 'rose',
    label: 'Crimson Quality',
    swatch: '#e11d48',
    desc: 'High-attention alert accent',
  },
];

export const ThemeCustomizerModal: React.FC<ThemeCustomizerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    themeMode,
    themeColor,
    sidebarCollapsed,
    setThemeMode,
    setThemeColor,
    setSidebarCollapsed,
  } = useThemeStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const persistPreference = async (patch: {
    themeMode?: ThemeMode;
    themeColor?: ThemeColor;
    sidebarCollapsed?: boolean;
  }) => {
    if (!isAuthenticated) return;
    try {
      setSaving(true);
      await apiClient.patch('/auth/preferences', patch);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1800);
    } catch {
      // Local Zustand store already persists in localStorage if backend is offline
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    void persistPreference({ themeMode: mode });
  };

  const handleColorChange = (color: ThemeColor) => {
    setThemeColor(color);
    void persistPreference({ themeColor: color });
  };

  const handleSidebarChange = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    void persistPreference({ sidebarCollapsed: collapsed });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4 bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-600)] text-white shadow-xs">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Workspace Appearance & Personalization
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Saved to your user profile (`tbl_sec_user_preference`)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Theme Mode */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
              Display Mode
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { id: 'light', label: 'Light Mode', icon: Sun },
                  { id: 'dark', label: 'Dark Mode', icon: Moon },
                  { id: 'system', label: 'System Sync', icon: Monitor },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = themeMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleModeChange(item.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'border-[var(--brand-500)] bg-[var(--brand-50)]/20 text-[var(--brand-600)] dark:text-[var(--brand-300)] ring-2 ring-[var(--brand-500)]/30'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brand Accent Color */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
              Primary Theme Color
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {COLOR_OPTIONS.map((c) => {
                const active = themeColor === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleColorChange(c.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition cursor-pointer ${
                      active
                        ? 'border-[var(--brand-500)] bg-[var(--bg-elevated)] ring-2 ring-[var(--brand-500)]/30'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-xs"
                      style={{ backgroundColor: c.swatch }}
                    >
                      {active && <Check className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {c.label}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate">
                        {c.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar Navigation Mode */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
              Sidebar Navigation Behavior
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSidebarChange(false)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition cursor-pointer ${
                  !sidebarCollapsed
                    ? 'border-[var(--brand-500)] bg-[var(--bg-elevated)] ring-2 ring-[var(--brand-500)]/30'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                }`}
              >
                <PanelLeftOpen className="h-5 w-5 text-[var(--brand-500)] shrink-0" />
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    Pinned Expanded
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Full 256px sidebar always visible
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSidebarChange(true)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition cursor-pointer ${
                  sidebarCollapsed
                    ? 'border-[var(--brand-500)] bg-[var(--bg-elevated)] ring-2 ring-[var(--brand-500)]/30'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                }`}
              >
                <PanelLeftClose className="h-5 w-5 text-[var(--brand-500)] shrink-0" />
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    Compact Rail (Hover-Expand)
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    72px icon rail, expands on hover
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-3.5">
          <div className="text-xs text-[var(--text-muted)]">
            {saving
              ? 'Syncing preferences to database...'
              : savedNotice
                ? '✓ Preferences saved to user profile'
                : 'Changes apply immediately across all screens'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
