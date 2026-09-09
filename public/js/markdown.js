/**
 * Onyx AI — Pipeline Markdown
 * marked (parse) → DOMPurify (sanitize) → post-process (kode, tabel, checklist, link)
 */
'use strict';

(function () {
  // ---- Konfigurasi marked -------------------------------------------------
  marked.use({
    gfm: true,
    breaks: true,
  });

  // ---- Hook DOMPurify: link aman & gambar lazy -----------------------------
  DOMPurify.addHook('afterSanitizeAttributes', function (node) {
    const tag = (node.tagName || '').toUpperCase();
    if (tag === 'A' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
      node.classList.add('md-link');
    }
    if (tag === 'IMG') {
      node.setAttribute('loading', 'lazy');
      node.setAttribute('draggable', 'false');
      node.classList.add('md-img');
    }
  });

  // ---- Alias bahasa untuk Prism --------------------------------------------
  const LANG_ALIAS = {
    js: 'javascript', node: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', 'c++': 'cpp', cc: 'cpp', cxx: 'cpp', 'c#': 'csharp', cs: 'csharp',
    py: 'python', python3: 'python', rb: 'ruby', golang: 'go', kt: 'kotlin',
    sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', terminal: 'bash',
    yml: 'yaml', md: 'markdown', html: 'markup', xml: 'markup', svg: 'markup',
    dockerfile: 'docker', rs: 'rust', postgres: 'sql', mysql: 'sql', sqlite: 'sql',
  };

  function resolveLang(raw) {
    if (!raw) return null;
    const l = raw.trim().toLowerCase();
    return LANG_ALIAS[l] || l;
  }

  const LANG_LABEL = {
    markup: 'HTML', javascript: 'JavaScript', typescript: 'TypeScript', jsx: 'JSX',
    tsx: 'TSX', python: 'Python', java: 'Java', bash: 'Bash', json: 'JSON',
    yaml: 'YAML', sql: 'SQL', go: 'Go', rust: 'Rust', c: 'C', cpp: 'C++',
    csharp: 'C#', php: 'PHP', ruby: 'Ruby', swift: 'Swift', kotlin: 'Kotlin',
    docker: 'Dockerfile', diff: 'Diff', ini: 'INI', toml: 'TOML', graphql: 'GraphQL',
    markdown: 'Markdown', css: 'CSS',
  };

  // ---- Post-processing ------------------------------------------------------
  function enhance(root) {
    // Blok kode: highlight + header (label bahasa + tombol salin)
    root.querySelectorAll('pre > code').forEach((code) => {
      const pre = code.parentElement;
      const rawLang = [...code.classList]
        .find((c) => c.startsWith('language-'));
      const lang = resolveLang(rawLang ? rawLang.replace('language-', '') : '');

      if (lang && window.Prism && Prism.languages[lang]) {
        try { Prism.highlightElement(code); } catch { /* abaikan */ }
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block';
      const header = document.createElement('div');
      header.className = 'code-head';
      const label = document.createElement('span');
      label.className = 'code-lang';
      label.textContent = (lang && LANG_LABEL[lang]) || (lang ? lang.toUpperCase() : 'Kode');
      const btn = document.createElement('button');
      btn.className = 'code-copy';
      btn.type = 'button';
      btn.title = 'Salin kode';
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Salin</span>';
      header.appendChild(label);
      header.appendChild(btn);

      pre.replaceWith(wrapper);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    });

    // Tabel: bungkus agar bisa scroll horizontal di mobile
    root.querySelectorAll('table').forEach((t) => {
      if (t.parentElement && t.parentElement.classList.contains('table-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      t.replaceWith(wrap);
      wrap.appendChild(t);
    });

    // Checklist: pastikan checkbox nonaktif
    root.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.setAttribute('disabled', '');
      cb.closest('li')?.classList.add('task-item');
    });
  }

  // ---- API publik -----------------------------------------------------------
  const MD = {
    /** Render markdown → elemen div (aman, sudah di-enhance). */
    render(text) {
      const container = document.createElement('div');
      container.className = 'md';
      if (!text) return container;

      let html;
      try {
        html = marked.parse(text);
      } catch {
        container.textContent = text;
        return container;
      }

      const clean = DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'rel', 'loading', 'draggable', 'disabled', 'checked', 'type'],
      });
      container.innerHTML = clean;
      enhance(container);
      return container;
    },

    /** Escape teks biasa agar aman ditampilkan (untuk error, dsb.). */
    escape(text) {
      const d = document.createElement('div');
      d.textContent = String(text ?? '');
      return d.innerHTML;
    },
  };

  window.OnyxMarkdown = MD;
})();
