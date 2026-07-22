import { ServiceManagerPlugin } from '@jupyterlab/services';
import { INbConvertExporters } from '@jupyterlite/services';
import { HTMLExporter } from './exporter';

/**
 * Plugin to register custom exporters.
 */
const exporterPlugin: ServiceManagerPlugin<void> = {
  id: 'jupyterlite-html-exporter:html-exporter',
  description: 'Exporter for Jupyter Notebooks to HTML.',
  autoStart: true,
  requires: [INbConvertExporters],
  activate: (_: null, exporters: INbConvertExporters): void => {
    // Register the custom exporter
    exporters.register('HTML', new HTMLExporter());

    console.log('Custom HTML exporter registered');
  }
};

export default exporterPlugin;
