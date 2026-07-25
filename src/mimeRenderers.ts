import {
  IMIMERendererFactories,
  IMIMERendererFactory,
  IMIMERenderer
} from './tokens';
import { PartialJSONObject } from '@lumino/coreutils';
import { MultilineString, IMimeBundle } from '@jupyterlab/nbformat';
import sanitizeHtml from 'sanitize-html';

export const DEFAULT_RANK = 10;

export class MIMERendererFactories implements IMIMERendererFactories {
  registerFactory(factory: IMIMERendererFactory) {
    this._factories.push(factory);

    // Rank each mime type by its highest-ranked factory
    for (const mimeType of factory.mimeTypes) {
      const currentRank = this._ranks.get(mimeType);
      const rank = factory.rank ?? DEFAULT_RANK;
      if (currentRank === undefined || currentRank < rank) {
        this._ranks.set(mimeType, rank);
      }
    }
  }

  createPreferredRenderer(mimeTypes: string[]): IMIMERenderer | undefined {
    // First, rank the MIME types
    let bestRank = -1;
    let bestMimeType = undefined;

    for (const mimeType of mimeTypes) {
      const rank = this._ranks.get(mimeType);
      if (rank === undefined || rank < bestRank) {
        continue;
      }

      bestRank = rank;
      bestMimeType = mimeType;
    }
    if (bestMimeType === undefined) {
      console.debug('No preferred renderer factory for', mimeTypes);
      return undefined;
    }

    // Now pick the factory with the preferred MIME
    bestRank = -1;
    let bestFactory = undefined;
    for (const factory of this._factories) {
      if (!factory.mimeTypes.includes(bestMimeType)) {
        continue;
      }

      const factoryRank = factory.rank ?? DEFAULT_RANK;
      if (factoryRank > bestRank) {
        bestRank = factoryRank;
        bestFactory = factory;
      }
    }
    console.debug('Creating', bestFactory, 'for', bestMimeType);
    return bestFactory!.factory(bestMimeType);
  }

  getFactories() {
    return Array.from(this._factories);
  }

  private _factories: IMIMERendererFactory[] = [];
  private _ranks = new Map<string, number>();
}

function ensureString(source: string | string[]): string {
  return Array.isArray(source) ? source.join('') : source;
}

export class HTMLMIMERendererFactory implements IMIMERendererFactory {
  mimeTypes = ['text/html'];
  rank = 100;

  factory(mimeType: string) {
    return (data: IMimeBundle, metadata: PartialJSONObject) =>
      ensureString(data[mimeType] as any as MultilineString);
  }
}

function createDataURI(mimeType: string, content: string): string {
  return `data:${mimeType};base64,${encodeURIComponent(content)}`;
}
export class ImageMIMERendererFactory implements IMIMERendererFactory {
  rank = 50;
  mimeTypes = ['image/png', 'image/jpeg'];
  factory(mimeType: string) {
    console.log('Factory for image');
    return (data: IMimeBundle, metadata: PartialJSONObject) => {
      const contents = data[mimeType] as string;
      const { width, height } = (metadata[mimeType] ?? {}) as any;

      const url = createDataURI(mimeType, contents);
      return `<img src="${sanitizeHtml(url)}" width="${sanitizeHtml(String(width ?? ''))}" height="${sanitizeHtml(String(height ?? ''))}"/>`;
    };
  }
}
export class TextMIMERendererFactory implements IMIMERendererFactory {
  mimeTypes = ['text/plain'];
  rank = 5;

  factory(mimeType: string) {
    return (data: IMimeBundle, metadata: PartialJSONObject) =>
      sanitizeHtml(ensureString(data[mimeType] as string | string[]));
  }
}

// Singleton so that we can share this between lite serices and frontend
export const mimeRendererFactories = new MIMERendererFactories();

// Register some default factories
mimeRendererFactories.registerFactory(new HTMLMIMERendererFactory());
mimeRendererFactories.registerFactory(new ImageMIMERendererFactory());
mimeRendererFactories.registerFactory(new TextMIMERendererFactory());
