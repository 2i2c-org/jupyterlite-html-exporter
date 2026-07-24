export interface IHTMLExportSettings {
  templates: {
    name: string;
    source: string;
  }[];
}

const DEFAULT_SETTINGS: IHTMLExportSettings = { templates: [] };

class HTMLExportSettings {
  get current(): IHTMLExportSettings {
    return this._current;
  }

  update(raw: Partial<IHTMLExportSettings> | null | undefined): void {
    this._current = {
      templates: raw?.templates ?? []
    };
  }
  private _current: IHTMLExportSettings = DEFAULT_SETTINGS;
}

export const htmlExportSettings = new HTMLExportSettings();
