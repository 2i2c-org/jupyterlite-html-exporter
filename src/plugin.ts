import { ServiceManagerPlugin } from '@jupyterlab/services';
import { INbConvertExporters } from '@jupyterlite/services';

/**
 * Plugin to register custom exporters.
 */
export const exporterPlugin: ServiceManagerPlugin<void> = {
  id: 'jupyterlite-html-exporter:html-exporter',
  description: 'Exporter for Jupyter Notebooks to HTML.',
  autoStart: true,
  optional: [INbConvertExporters],
  activate: async (
    _: null,
    exporters: INbConvertExporters | null
  ): Promise<void> => {
    if (exporters === null) {
      return;
    }
    // Register the custom exporter
    const { HTMLExporter } = await import('./exporter');
    exporters.register('HTML', new HTMLExporter());

    console.log('Custom HTML exporter registered');
  }
};
