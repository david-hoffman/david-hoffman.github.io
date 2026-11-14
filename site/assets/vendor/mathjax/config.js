// Local MathJax 3.2.2. Use the packages bundled in tex-svg.js; no remote loaders.
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    packages: ['base', 'ams', 'newcommand', 'noundefined', 'configmacros']
  },
  svg: { fontCache: 'local' },
  options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
  startup: {
    ready() {
      const MathJax = window.MathJax;
      const { Menu } = MathJax._.ui.menu.Menu;

      // The local bundle includes SVG and assistive MathML, but not the
      // alternate renderer, expression explorer, or equation collapsing.
      MathJax.config.options.MenuClass = class extends Menu {
        mergeUserSettings() {
          super.mergeUserSettings();
          const supportedSettings = {
            renderer: 'SVG', explorer: false, collapsible: false, autocollapse: false
          };
          const needsRepair = Object.entries(supportedSettings).some(
            ([key, value]) => this.settings[key] !== value
          );
          Object.assign(this.settings, supportedSettings);
          // Repair preferences saved before these menu choices were restricted.
          // MathJax handles browsers that deny localStorage access.
          if (needsRepair) this.saveUserSettings();
        }

        checkLoadableItems() {
          super.checkLoadableItems();
          this.menu.findID('Settings', 'Renderer', 'CHTML').disable();
          for (const item of ['Activate', 'AutoCollapse', 'Collapsible']) {
            this.menu.findID('Accessibility', item).disable();
          }
        }
      };

      MathJax.startup.defaultReady();
    }
  }
};
