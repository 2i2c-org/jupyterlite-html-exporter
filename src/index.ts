import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

/**
 * Initialization data for the jupyterlite-html-exporter extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlite-html-exporter:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (app: JupyterFrontEnd, settingRegistry: ISettingRegistry | null) => {
    console.log('JupyterLab extension jupyterlite-html-exporter is activated!');

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('jupyterlite-html-exporter settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for jupyterlite-html-exporter.', reason);
        });
    }
  }
};

export default plugin;
