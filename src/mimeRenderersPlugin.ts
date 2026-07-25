import { mimeRendererFactories } from './mimeRenderers';
import { IMIMERendererFactories } from './tokens';

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

export const PLUGIN_ID = 'jupyterlite-html-exporter:mime-renderers';

/**
 * Plugin to register custom renderers.
 */
export const mimeRenderersPlugin: JupyterFrontEndPlugin<IMIMERendererFactories> =
  {
    id: PLUGIN_ID,
    description: 'Registry for HTML MIME renderers.',
    autoStart: true,
    provides: IMIMERendererFactories,
    activate: async (
      app: JupyterFrontEnd
    ): Promise<IMIMERendererFactories> => {
      return mimeRendererFactories;
    }
  };
