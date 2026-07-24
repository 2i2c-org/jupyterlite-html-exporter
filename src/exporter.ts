import type {
  INotebookContent,
  IOutput,
  OutputMetadata,
  IMimeBundle
} from '@jupyterlab/nbformat';
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
import defaultTemplate from '@/template.html.j2';

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

function createDataURI(mimeType: string, content: string): string {
  return `data:${mimeType};base64,${encodeURIComponent(content)}`;
}

function buildEnvironment(
  lang: string,
  settings: IHTMLExportSettings
): Environment {
  const highlighterConfig: HighlighterConfig = {
    themes: {
      light: 'vitesse-light',
      dark: 'vitesse-dark'
    }
  };
  const highlighter = buildHighlighter();
  const processor = buildProcessor(highlighter, highlighterConfig);
  const env = new Environment();

  function codeToHTML(source: string): string {
    const markdown = `\`\`\`${lang}\n${source}\n\`\`\``;
    return String(processor.processSync(markdown));
  }

  function markdownToHTML(source: string): string {
    return String(processor.processSync(source));
  }

  function mimeToHTML(data: IMimeBundle, metadata: OutputMetadata) {
    if ('text/html' in data) {
      return ensureString(data['text/html'] as string | string[]);
    }
    for (const mimeType of ['image/png', 'image/jpeg']) {
      if (mimeType in data) {
        const contents = data[mimeType] as string;

        const url = createDataURI(mimeType, contents);
        const { width, height } = (metadata[mimeType] ?? {}) as any;
        return `<img src="${sanitizeHtml(url)}" width="${sanitizeHtml(String(width ?? ''))}" height="${sanitizeHtml(String(height ?? ''))}"/>`;
      }
    }
    if ('text/plain' in data) {
      return sanitizeHtml(
        ensureString(data['text/plain'] as string | string[])
      );
    }
    throw new Error();
  }

  function outputToHTML(_output: any): string {
    const output = mapToObject(_output) as IOutput;

    if (isExecuteResult(output) || isDisplayData(output)) {
      return mimeToHTML(output.data, output.metadata);
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
  }

  function ensureString(source: string | string[]): string {
    return Array.isArray(source) ? source.join('') : source;
  }

  env.addFilter('render_code', codeToHTML);
  env.addFilter('render_markdown', markdownToHTML);
  env.addFilter('render_output', outputToHTML);
  env.addFilter('render_output', outputToHTML);
  env.addFilter('ensure_str', ensureString);

  let hasNotebook = false;
  for (const { name, source } of settings.templates) {
    env.addTemplate(name, source);
    if (name === 'index') {
      hasNotebook = true;
    }
  }

  env.addTemplate('base', defaultTemplate);
  if (!hasNotebook) {
    env.addTemplate('index', `{% extends "base" %}`);
  }
  return env;
}

async function exportHTML(
  notebook: INotebookContent,
  settings: IHTMLExportSettings
): Promise<string> {
  await init();
  const lang = (
    notebook.metadata?.language_info?.name || 'python'
  ).toLowerCase();
  const env = buildEnvironment(lang, settings);
  return env.renderTemplate('index', { notebook });
}

export class HTMLExporter implements IExporter {
  /**
   * The MIME type of the exported format.
   */
  readonly mimeType = 'text/html';

  /**
   * Export a notebook to Markdown format.
   *
   * @param model The notebook model to export
   * @param path The path to the notebook
   */
  async export(model: Contents.IModel, path: string): Promise<void> {
    console.dir(model);
    const content = await exportHTML(model.content, htmlExportSettings.current);
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
