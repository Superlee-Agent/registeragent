import React from "react";
import { Check, X } from "lucide-react";
import type { Plan, RegisterState } from "@/types/agents";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { statusText } from "./PlanBox.local";

interface PlanBoxProps {
  plan: Plan;
  onConfirm: () => void;
  onCancel: () => void;
  registerState?: RegisterState;
  onLicenseChange?: (data: { pilType: 'open_use' | 'commercial_remix'; revShare?: number; licensePrice?: number; aiLearning?: boolean }) => void;
  selectedPilType?: 'open_use' | 'commercial_remix';
  selectedRevShare?: number;
  selectedLicensePrice?: number;
  selectedAiLearning?: boolean;
  aiContent?: boolean;
  hideLicenseControls?: boolean;
}

export function PlanBox({ plan, onConfirm, onCancel, registerState, onLicenseChange, selectedPilType, selectedRevShare, selectedLicensePrice, selectedAiLearning, aiContent, hideLicenseControls }: PlanBoxProps) {
  const { t } = useI18n();
  const isExecuting = (plan.type === "register" && registerState?.status !== 'idle' && registerState?.status !== 'error');

  const getStatusText = () => {
    if (plan.type === "register" && registerState) {
      return statusText(t, registerState.status);
    }
    return "";
  };

  const getProgressPercent = () => {
    if (plan.type === "register" && registerState) {
      return registerState.progress;
    }
    return 0;
  };

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="space-y-1 text-sm">
        {plan.steps.map((step, index) => (
          <div key={index}>{step}</div>
        ))}
      </div>

      {plan.type === 'register' && !hideLicenseControls && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            {t('planBox.licenseType')}
            <select
              className="bg-transparent border border-white/20 rounded p-2"
              onChange={(e) => onLicenseChange?.({ pilType: (e.target.value as any) })}
              defaultValue={selectedPilType || 'open_use'}
            >
              <option value="open_use">{t('license.option.openUse')}</option>
              <option value="commercial_remix">{t('license.option.commercialRemix')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {t('planBox.revShare')}
            <input
              type="number"
              className="bg-transparent border border-white/20 rounded p-2 disabled:opacity-50"
              min={0}
              max={100}
              step={1}
              defaultValue={selectedRevShare ?? 0}
              disabled={(selectedPilType || 'open_use') !== 'commercial_remix'}
              onChange={(e) => onLicenseChange?.({ pilType: selectedPilType || 'open_use', revShare: Number(e.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1">
            {t('planBox.licenseFee')}
            <input
              type="number"
              className="bg-transparent border border-white/20 rounded p-2 disabled:opacity-50"
              min={0}
              step={0.0001}
              defaultValue={selectedLicensePrice ?? 0}
              disabled={(selectedPilType || 'open_use') !== 'commercial_remix'}
              onChange={(e) => onLicenseChange?.({ pilType: selectedPilType || 'open_use', licensePrice: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              className="accent-sky-400"
              defaultChecked={!!selectedAiLearning}
              disabled={!!aiContent}
              onChange={(e) => onLicenseChange?.({ pilType: selectedPilType || 'open_use', aiLearning: e.target.checked })}
            />
            <span>{t('planBox.aiLearning')}</span>
          </label>
        </div>
      )}

      {/* Progress indicator */}
      {isExecuting && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="opacity-70">{getStatusText()}</span>
            <span className="opacity-70">{getProgressPercent()}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div 
              className="bg-sky-400 h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${getProgressPercent()}%` }}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-3">
        <button
          className="rounded-2xl bg-sky-500/90 hover:bg-sky-400 text-white px-4 py-2 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onConfirm}
          disabled={isExecuting}
        >
          <Check className="h-4 w-4" />
          {isExecuting ? getStatusText() : t('planBox.confirm')}
        </button>
        
        <button
          className="rounded-2xl border border-white/10 px-4 py-2 inline-flex items-center gap-2 hover:bg-white/5 disabled:opacity-50"
          onClick={onCancel}
          disabled={isExecuting}
        >
          <X className="h-4 w-4" />
          {t('planBox.cancel')}
        </button>
      </div>

      {/* Error display */}
      {(registerState?.status === 'error' && registerState.error) && (
        <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          {t('planBox.error')} {registerState?.error?.message || t('planBox.unknownError')}
        </div>
      )}
    </div>
  );
}
