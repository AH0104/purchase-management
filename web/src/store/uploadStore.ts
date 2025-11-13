"use client";

import { create } from "zustand";
import { UploadParseResult } from "@/types/delivery";

type UploadStep = 1 | 1.5 | 2 | 3;

type UploadState = {
  step: UploadStep;
  supplierId: number | null;
  supplierName?: string;
  file: File | null;
  result: UploadParseResult | null;
  isSaving: boolean;
  uploadProgress: number;
  needsMapping: boolean;
  setNeedsMapping: (needs: boolean) => void;
  setSupplier: (supplierId: number | null, supplierName?: string) => void;
  setFile: (file: File | null) => void;
  setResult: (result: UploadParseResult | null) => void;
  setStep: (step: UploadStep) => void;
  setSaving: (saving: boolean) => void;
  setProgress: (progress: number) => void;
  reset: () => void;
};

const initialState = {
  step: 1 as UploadStep,
  supplierId: null,
  file: null,
  result: null,
  isSaving: false,
  uploadProgress: 0,
  needsMapping: false,
};

export const useUploadStore = create<UploadState>((set) => ({
  ...initialState,
  setSupplier: (supplierId, supplierName) => set({ supplierId, supplierName }),
  setFile: (file) => set({ file }),
  setResult: (result) => set({ result }),
  setStep: (step) => set({ step }),
  setSaving: (isSaving) => set({ isSaving }),
  setProgress: (uploadProgress) => set({ uploadProgress }),
  setNeedsMapping: (needsMapping) => set({ needsMapping }),
  reset: () => set(initialState),
}));


