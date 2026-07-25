import { Token, PartialJSONObject } from '@lumino/coreutils';
import type { IMimeBundle } from '@jupyterlab/nbformat';
/**
 * The token for the exporter registry.
 */
export const IMIMERendererFactories = new Token<IMIMERendererFactories>(
  'jupyterlite-html-exporter:IMIMERendererFactories',
  `A manager for MIME renderer factories.`
);
export interface IMIMERenderer {
  (data: IMimeBundle, metadata: PartialJSONObject): string;
}

export interface IMIMERendererFactory {
  rank?: number;
  mimeTypes: string[];
  factory: (mimeType: string) => IMIMERenderer;
}

/**
 * Interface for the MIME renderer registry.
 */
export interface IMIMERendererFactories {
  /**
   * Register a new MIME renderer.
   *
   * @param renderer The renderer instance
   */
  registerFactory(renderer: IMIMERendererFactory): void;

  createPreferredRenderer(mimeTypes: string[]): IMIMERenderer | undefined;

  /**
   * Get all registered export formats.
   *
   * @returns A map of format names to their MIME types
   */
  getFactories(): IMIMERendererFactory[];
}
