export interface IHTMLExportSettings {
  style: string | null;
  extraStyle: string | null;
}

const DEFAULT_SETTINGS: IHTMLExportSettings = { style: null, extraStyle: null };

class HTMLExportSettings {
  get current(): IHTMLExportSettings {
    return this._current;
  }

  update(raw: Partial<IHTMLExportSettings> | null | undefined): void {
    this._current = {
      style: raw?.style ?? null,
      extraStyle: raw?.extraStyle ?? null
    };
  }
  private _current: IHTMLExportSettings = DEFAULT_SETTINGS;
}

export const htmlExportSettings = new HTMLExportSettings();
