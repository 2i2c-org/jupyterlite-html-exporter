import { Contents } from '@jupyterlab/services';
import { IExporter } from '@jupyterlite/services';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

export class HTMLExporter implements IExporter {
  /**
   * The MIME type of the exported format.
   */
  readonly mimeType = 'text/html';

  private async _markdownToHTML(markdown: string): Promise<string> {
    const file = await unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process(markdown);
    return String(file);
  }

  /**
   * Export a notebook to Markdown format.
   *
   * @param model The notebook model to export
   * @param path The path to the notebook
   */
  async export(model: Contents.IModel, path: string): Promise<void> {
    const content = await this._convertToMarkdown(model.content);
    const filename = path.replace(/\.ipynb$/, '.html');
    this.triggerDownload(content, this.mimeType, filename);
  }

  /**
   * Convert notebook content to Markdown.
   */
  private async _convertToMarkdown(notebook: any): Promise<string> {
    const lines: string[] = [];
    const cells = notebook.cells || [];

    for (const cell of cells) {
      const source = Array.isArray(cell.source)
        ? cell.source.join('')
        : cell.source;

      if (cell.cell_type === 'markdown') {
        lines.push(await this._markdownToHTML(source));
      } else if (cell.cell_type === 'raw') {
        lines.push(source);
      } else if (cell.cell_type === 'code') {
        const lang = notebook.metadata?.language_info?.name || 'python';
        const codeBlock = `\`\`\`${lang}\n${source}\n\`\`\``;
        lines.push(await this._markdownToHTML(codeBlock));
      }
      lines.push(''); // blank line between cells
    }

    return lines.join('\n');
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
