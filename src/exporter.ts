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
import remarkRehype from 'remark-rehype';
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
    .use(remarkRehype)
    .use(rehypeShikiFromHighlighter, highlighter as any, highlighterConfig)
    .use(rehypeStringify);
}

function createDataURI(mimeType: string, content: string): string {
  return `data:${mimeType};base64,${encodeURIComponent(content)}`;
}

function buildEnvironment(lang: string): Environment {
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
        const { width, height } = metadata;
        console.log({ url, sanitized: sanitizeHtml(url) });
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
  return env;
}

const TEMPLATE = `
<div class="notebook">
{% for cell in notebook.cells %}
<div class="cell cell-{{ cell.cell_type }}">
{% if cell.cell_type == "code" %}
<div class="input-area">
<span class="execution-count">In [{{ cell.execution_count or " "}}]</span>
<div class="input-source">
{{ cell.source | ensure_str | render_code }}
</div>
</div>
<div class="output-area">
<span class="execution-count">Out [{{ cell.execution_count or " "}}]</span>

<div class="output-collection">
{% for output in cell.outputs %}
<div class="output">{{ output | render_output }}</div>
{% endfor %}
</div>
</div>
{% elif cell.cell_type == "markdown" %}
{{ cell.source | ensure_str | render_markdown }}
{% elif cell.cell_type == "raw" %}
{{ cell.source | ensure_str }}
{% endif %}
</div>
{% endfor %}
</div>
`;
async function exportHTML(notebook: INotebookContent): Promise<string> {
  await init();
  console.dir(notebook, { depth: null });
  const lang = notebook.metadata?.language_info?.name || 'python';
  const env = buildEnvironment(lang);
  return env.renderStr(TEMPLATE, { notebook });
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
    const content = await exportHTML(model.content);
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
