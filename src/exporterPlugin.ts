import { ServiceManagerPlugin } from '@jupyterlab/services';
import { INbConvertExporters } from '@jupyterlite/services';

export const PLUGIN_ID = 'jupyterlite-html-exporter:exporter';

/**
 * Plugin to register custom exporters.
 */
export const exporterPlugin: ServiceManagerPlugin<void> = {
  id: PLUGIN_ID,
  description: 'Exporter for Jupyter Notebooks to HTML.',
  autoStart: true,
  optional: [INbConvertExporters],
  activate: async (
    _: null,
    exporters: INbConvertExporters | null
  ): Promise<void> => {
    console.log('Custom HTML exporter loading...');
    if (exporters === null) {
      return;
    }
    // Register the custom exporter
    // Import lazily, so that JupyterLab does not trigger this pathway
    const { HTMLExporter } = await import('./exporter');
    exporters.register('HTML', new HTMLExporter());
    console.log('Custom HTML exporter registered');
  }
};
