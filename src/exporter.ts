import { Contents } from '@jupyterlab/services';
import { IExporter } from '@jupyterlite/services';

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
    const content = this._convertToMarkdown(model.content);
    const filename = path.replace(/\.ipynb$/, '.md');
    this.triggerDownload(content, this.mimeType, filename);
  }

  /**
   * Convert notebook content to Markdown.
   */
  private _convertToMarkdown(notebook: any): string {
    const lines: string[] = [];
    //const cells = notebook.cells || [];

    /**
    for (const cell of cells) {
      const source = Array.isArray(cell.source)
        ? cell.source.join('')
        : cell.source;

      if (cell.cell_type === 'markdown' || cell.cell_type === 'raw') {
        lines.push(source);
      } else if (cell.cell_type === 'code') {
              lines.push(
          '```' + (notebook.metadata?.language_info?.name || 'python')
        );
        lines.push(source);
        lines.push('```');
        
      }
      lines.push(''); // blank line between cells
    }
      */

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
