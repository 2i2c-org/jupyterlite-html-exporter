import type { INotebookContent, IOutput } from '@jupyterlab/nbformat';
import {
  isExecuteResult,
  isDisplayData,
  isStream,
  isError
} from '@jupyterlab/nbformat';
import { Contents } from '@jupyterlab/services';
import { IExporter } from '@jupyterlite/services';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeMathjax from 'rehype-mathjax';
import remarkMath from 'remark-math';
import { unified } from 'unified';
import init, { Environment } from 'minijinja-js/dist/web';

import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { createHighlighterCoreSync, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import rLang from '@shikijs/langs/r';
import pyLang from '@shikijs/langs/python';
import jsLang from '@shikijs/langs/javascript';
import bashLang from '@shikijs/langs/bash';
import vitessLight from '@shikijs/themes/vitesse-light';
import vitessDark from '@shikijs/themes/vitesse-dark';
import sanitizeHtml from 'sanitize-html';

import { htmlExportSettings, type IHTMLExportSettings } from './settings';
import { mimeRendererFactories } from './mimeRenderers';
import defaultTemplate from '@/template.html.j2';

namespace Private {
  /**
   * Convert from a recursive Map structure to plain JS objects
   *
   * These Maps are produced by minijinja-js
   */
  function mapToObject(obj: Map<string, any>): any {
    const result: any = {};
    for (const [key, value] of obj.entries()) {
      if (value instanceof Map) {
        result[key] = mapToObject(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
  function buildHighlighter(): HighlighterCore {
    return createHighlighterCoreSync({
      themes: [vitessDark, vitessLight],
      langs: [rLang, pyLang, bashLang, jsLang],
      engine: createJavaScriptRegexEngine()
    });
  }

  function ensureString(source: string | string[]): string {
    return Array.isArray(source) ? source.join('') : source;
  }

  type HighlighterConfig = {
    themes: Record<string, string>;
  };

  function buildProcessor(
    highlighter: HighlighterCore,
    highlighterConfig: HighlighterConfig
  ) {
    return unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeMathjax)
      .use(rehypeShikiFromHighlighter, highlighter as any, highlighterConfig)
      .use(rehypeStringify);
  }

  export async function renderNotebook(
    notebook: INotebookContent,
    settings: IHTMLExportSettings
  ): Promise<string> {
    await init();

    const lang = (
      notebook.metadata?.language_info?.name || 'python'
    ).toLowerCase();

    const highlighterConfig: HighlighterConfig = {
      themes: {
        light: 'vitesse-light',
        dark: 'vitesse-dark'
      }
    };
    const highlighter = buildHighlighter();
    const processor = buildProcessor(highlighter, highlighterConfig);
    const env = new Environment();

    env.addFilter('render_code', (source: string) =>
      String(processor.processSync(`\`\`\`${lang}\n${source}\n\`\`\``))
    );
    env.addFilter('render_markdown', (source: string) =>
      String(processor.processSync(source))
    );
    env.addFilter('render_output', (_output: any) => {
      const output = mapToObject(_output) as IOutput;

      if (isExecuteResult(output) || isDisplayData(output)) {
        const renderer = mimeRendererFactories.createPreferredRenderer(
          Object.keys(output.data)
        );
        if (renderer === undefined) {
          throw new Error();
        }
        return renderer(output.data, output.metadata);
      } else if (isError(output)) {
        const rawTraceback = output.traceback.join('\n');
        const traceback = highlighter.codeToHtml(rawTraceback, {
          lang: 'ansi',
          ...highlighterConfig
        });
        return `<pre class="output-error stream-error">${traceback}</pre>`;
      } else if (isStream(output)) {
        const stream = ensureString(output.text);
        return `<pre class="output-stream stream-${output.name}">${sanitizeHtml(stream)}</pre>`;
      }
      throw new Error();
    });

    env.addFilter('ensure_str', ensureString);

    const templates = new Map<string, string>();
    templates.set('index', `{% extends "base" %}`);
    templates.set('base', defaultTemplate);

    // Register user templates, permitting them to clobber the built-in one.
    for (const { name, source } of settings.templates) {
      templates.set(name, source);
    }

    // Write templates to env
    for (const [name, source] of templates.entries()) {
      env.addTemplate(name, source);
    }
    return env.renderTemplate('index', { notebook });
  }
}

export class HTMLExporter implements IExporter {
  /**
   * The MIME type of the exported format.
   */
  readonly mimeType = 'text/html';

  constructor() {}

  /**
   * Export a notebook to Markdown format.
   *
   * @param model The notebook model to export
   * @param path The path to the notebook
   */
  async export(model: Contents.IModel, path: string): Promise<void> {
    const notebook = model.content;
    const settings = htmlExportSettings.current;
    const content = await Private.renderNotebook(notebook, settings);
    const filename = path.replace(/\.ipynb$/, '.html');
    this.triggerDownload(content, this.mimeType, filename);
  }

  /**
   * Trigger a browser download of the exported content.
   */
  protected triggerDownload(
    content: string,
    mimeType: string,
    filename: string
  ): void {
    const element = document.createElement('a');
    element.href = `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
}
