import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { IHTMLExportSettings, htmlExportSettings } from './settings';
import { PLUGIN_ID } from './exporterPlugin';

export const settingsPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlite-html-exporter:settings',
  description: 'Loads settings for the HTML exporter',
  autoStart: true,
  requires: [ISettingRegistry],
  activate: (
    _app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry
  ): void => {
    const load = (settings: ISettingRegistry.ISettings): void => {
      htmlExportSettings.update(
        settings.composite as unknown as Partial<IHTMLExportSettings>
      );
    };

    settingRegistry
      .load(PLUGIN_ID)
      .then(settings => {
        load(settings);
        settings.changed.connect(load);
      })
      .catch(reason => {
        const msg = reason instanceof Error ? reason.message : String(reason);
        console.error(
          `Failed to load settings for ${PLUGIN_ID}: ${msg}. ` +
            'Falling back to the default HTML export settings.'
        );
      });
  }
};
