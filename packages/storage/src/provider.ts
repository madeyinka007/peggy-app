export interface SignParams {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder?: string;
  publicId?: string;
  [key: string]: string | number | undefined;
}

export interface SignRequest {
  filename: string;
  mime: string;
  sizeBytes: number;
  folderId?: string;
}

export interface ConfirmRequest {
  providerKey: string;
  mime: string;
  sizeBytes: number;
  folderId?: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
  durationS?: number;
  hashSha256?: string;
  uploadedBy?: string;
}

export interface TransformPreset {
  w?: number;
  h?: number;
  q?: string | number;
  format?: string;
  preset?: "thumb" | "card" | "hero" | "original";
}

export interface StorageProvider {
  signUpload(req: SignRequest): Promise<{ url: string; params: SignParams }>;
  verifyAsset(providerKey: string): Promise<{ exists: boolean; width?: number; height?: number; mime?: string; sizeBytes?: number }>;
  transformUrl(providerKey: string, opts: TransformPreset, cloudName?: string): string;
  destroy(providerKey: string): Promise<void>;
}
