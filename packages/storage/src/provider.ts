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
  /**
   * MIME of the asset being transformed. Used to route to the correct
   * provider resource-type endpoint (image/video/raw). Defaults to image
   * when omitted (preserves existing URLs).
   */
  mime?: string;
}

export interface StorageProvider {
  signUpload(req: SignRequest): Promise<{ url: string; params: Record<string, string | number | undefined> }>;
  /**
   * HEAD cross-check against the provider. `mimeHint` selects the correct
   * provider resource-type endpoint (image/video/raw); defaults to image
   * when the caller does not know the MIME yet.
   */
  verifyAsset(providerKey: string, mimeHint?: string): Promise<{ exists: boolean; width?: number; height?: number; mime?: string; sizeBytes?: number }>;
  transformUrl(providerKey: string, opts: TransformPreset, cloudName?: string): string;
  /**
   * Signed provider destroy. `mimeHint` selects the resource-type endpoint;
   * defaults to image.
   */
  destroy(providerKey: string, mimeHint?: string): Promise<void>;
}
