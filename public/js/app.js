/**
 * ============================================================
 *  O N Y X   A I  —  Aplikasi Utama
 * ============================================================
 *  Chat ala ChatGPT/Gemini bertenaga Google Gemini:
 *  streaming, unggah gambar/PDF/audio, generate gambar,
 *  riwayat obrolan, markdown, PWA, tema gelap/terang.
 * ============================================================
 */
'use strict';

(function () {
  // ==================================================================
  // 1. UTILITAS DASAR
  // ==================================================================
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
  }
  function fmtDur(ms) {
    const s = ms / 1000;
    return s < 10 ? s.toFixed(1).replace('.', ',') + ' dtk' : Math.round(s) + ' dtk';
  }
  function fmtNum(n) {
    return (n || 0).toLocaleString('id-ID');
  }
  function fmtClock(ts) {
    return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  function relTime(ts) {
    const d = Date.now() - ts;
    const m = Math.floor(d / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return m + ' mnt';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' jam';
    const dd = Math.floor(h / 24);
    if (dd === 1) return 'kemarin';
    if (dd < 7) return dd + ' hari';
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }
  const b64FromDataUrl = (du) => (du.includes(',') ? du.split(',')[1] : du);

  // ==================================================================
  // 2. KONSTANTA & STATE
  // ==================================================================
  const CFG = window.ONYX_CONFIG;
  const MD = window.OnyxMarkdown;

  const LS_CHATS = 'onyx.chats.v1';
  const LS_SETTINGS = 'onyx.settings.v1';

  const state = {
    chats: [],            // seluruh obrolan
    currentId: null,      // obrolan aktif
    settings: {
      theme: 'dark',
      temperature: 0.8,
      systemPrompt: CFG.DEFAULT_SYSTEM_PROMPT,
      apiKey: '',
      model: CFG.MODELS[0].id,
    },
    attachments: [],      // lampiran yang menunggu dikirim
    generating: false,
    ctrl: null,           // AbortController aktif
    stoppedByUser: false,
    stick: true,          // auto-scroll aktif?
    search: '',
  };

  const dom = {};
  function cacheDom() {
    dom.sidebar = $('#sidebar');
    dom.backdrop = $('#backdrop');
    dom.chatList = $('#chatList');
    dom.searchChats = $('#searchChats');
    dom.btnNewChat = $('#btnNewChat');
    dom.btnMenu = $('#btnMenu');
    dom.btnCloseSidebar = $('#btnCloseSidebar');
    dom.btnSettings = $('#btnSettings');
    dom.btnTheme = $('#btnTheme');
    dom.btnNewChatTop = $('#btnNewChatTop');
    dom.modelBtn = $('#modelBtn');
    dom.modelLabel = $('#modelLabel');
    dom.modelIco = $('#modelIco');
    dom.modelMenu = $('#modelMenu');
    dom.modelPicker = $('#modelPicker');
    dom.scroller = $('#scroller');
    dom.welcome = $('#welcome');
    dom.suggestGrid = $('#suggestGrid');
    dom.messages = $('#messages');
    dom.btnScrollDown = $('#btnScrollDown');
    dom.composer = $('#composer');
    dom.input = $('#input');
    dom.btnSend = $('#btnSend');
    dom.btnAttach = $('#btnAttach');
    dom.attachRow = $('#attachRow');
    dom.fileInput = $('#fileInput');
    dom.dropOverlay = $('#dropOverlay');
    dom.toasts = $('#toasts');
    dom.lightbox = $('#lightbox');
    dom.lightboxImg = $('#lightboxImg');
    dom.lightboxDl = $('#lightboxDl');
    dom.settingsModal = $('#settingsModal');
  }

  const getModel = (id) => CFG.MODELS.find((m) => m.id === id) || CFG.MODELS[0];
  const currentModel = () => getModel(state.settings.model);
  const currentChat = () => state.chats.find((c) => c.id === state.currentId) || null;

  // ==================================================================
  // 3. IKON SVG (untuk elemen dinamis)
  // ==================================================================
  const ICONS = {
    gem: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/><path d="M2 9h20M9 3l3 6 3-6M12 21 9 9m3 12 3-12"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M13 2 3 14h8l-1 8 11-13h-8l0-7z"/></svg>',
    feather: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5l6.74-6.76z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/></svg>',
    flame: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    palette: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".7"/><circle cx="17.5" cy="10.5" r=".7"/><circle cx="8.5" cy="7.5" r=".7"/><circle cx="6.5" cy="12.5" r=".7"/><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2 2 2 0 0 1 2-2h2a4 4 0 0 0 4-4 10 10 0 0 0-10-10z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    regen: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
    file: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/></svg>',
    audio: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg>',
  };

  // ==================================================================
  // 4. PENYIMPANAN (localStorage + degrade kuota)
  // ==================================================================
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
      Object.assign(state.settings, s);
      if (!CFG.MODELS.some((m) => m.id === state.settings.model)) {
        state.settings.model = CFG.MODELS[0].id;
      }
    } catch { /* abaikan */ }

    try {
      state.chats = JSON.parse(localStorage.getItem(LS_CHATS) || '[]');
      if (!Array.isArray(state.chats)) state.chats = [];
    } catch {
      state.chats = [];
    }
  }

  let quotaWarned = false;
  function persistChats() {
    // Kunci berawali "_" hanya hidup di RAM (data penuh), tidak di-persist
    const replacer = (k, v) => (k.startsWith('_') ? undefined : v);
    try {
      localStorage.setItem(LS_CHATS, JSON.stringify(state.chats, replacer));
      return;
    } catch { /* kuota penuh → degrade */ }

    // Degrade 1: buang thumbnail & gambar lama (paling lama dulu)
    const stripped = JSON.parse(JSON.stringify(state.chats, replacer));
    for (const ch of stripped) for (const m of ch.messages) {
      if (m.attachments) m.attachments.forEach((a) => { delete a.thumb; });
    }
    try { localStorage.setItem(LS_CHATS, JSON.stringify(stripped)); return; } catch { }

    // Degrade 2: buang seluruh gambar hasil generate
    for (const ch of stripped) for (const m of ch.messages) { delete m.images; }
    try { localStorage.setItem(LS_CHATS, JSON.stringify(stripped)); return; } catch { }

    if (!quotaWarned) {
      quotaWarned = true;
      toast('Penyimpanan penuh — riwayat terbaru mungkin tidak tersimpan. Ekspor obrolanmu di Pengaturan.', 'error', 6000);
    }
  }

  const persistSettings = () => {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings)); } catch { }
  };

  // ==================================================================
  // 5. TEMA
  // ==================================================================
  const mediaDark = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme() {
    const t = state.settings.theme;
    const dark = t === 'dark' || (t === 'auto' && mediaDark.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#0a0a12' : '#f4f4f8';
  }

  function cycleTheme() {
    const order = ['dark', 'light', 'auto'];
    const cur = state.settings.theme;
    state.settings.theme = order[(order.indexOf(cur) + 1) % order.length];
    persistSettings();
    applyTheme();
    syncSettingsUI();
    const label = { dark: 'Gelap', light: 'Terang', auto: 'Ikut sistem' }[state.settings.theme];
    toast('Tema: ' + label, 'info', 1600);
  }

  mediaDark.addEventListener('change', () => {
    if (state.settings.theme === 'auto') applyTheme();
  });

  // ==================================================================
  // 6. TOAST & KONFIRMASI
  // ==================================================================
  function toast(msg, type = 'info', ms = 3000) {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<span class="toast-dot"></span><span>${MD.escape(msg)}</span>`;
    dom.toasts.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const kill = () => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    };
    el.addEventListener('click', kill);
    setTimeout(kill, ms);
  }

  function uiConfirm({ title, message, okText = 'Hapus', danger = true }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal confirm-modal';
      wrap.innerHTML = `
        <div class="modal-card small">
          <h3 class="confirm-title">${MD.escape(title)}</h3>
          <p class="confirm-msg">${MD.escape(message)}</p>
          <div class="confirm-actions">
            <button class="ghost-btn" data-act="cancel">Batal</button>
            <button class="primary-btn ${danger ? 'danger' : ''}" data-act="ok">${MD.escape(okText)}</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('open'));
      const close = (val) => {
        wrap.classList.remove('open');
        setTimeout(() => wrap.remove(), 200);
        resolve(val);
      };
      wrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (b) return close(b.dataset.act === 'ok');
        if (e.target === wrap) close(false);
      });
    });
  }

  // ==================================================================
  // 7. SIDEBAR: DAFTAR OBROLAN
  // ==================================================================
  function groupChats(chats) {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const start7 = startToday - 6 * 86400000;
    const groups = [
      ['Hari Ini', []],
      ['Kemarin', []],
      ['7 Hari Terakhir', []],
      ['Lebih Lama', []],
    ];
    for (const c of [...chats].sort((a, b) => b.updatedAt - a.updatedAt)) {
      if (c.updatedAt >= startToday) groups[0][1].push(c);
      else if (c.updatedAt >= startToday - 86400000) groups[1][1].push(c);
      else if (c.updatedAt >= start7) groups[2][1].push(c);
      else groups[3][1].push(c);
    }
    return groups.filter(([, arr]) => arr.length);
  }

  function renderChatList() {
    const q = state.search.trim().toLowerCase();
    const chats = q
      ? state.chats.filter((c) => (c.title || '').toLowerCase().includes(q) ||
          c.messages.some((m) => (m.text || '').toLowerCase().includes(q)))
      : state.chats;

    dom.chatList.innerHTML = '';

    if (!chats.length) {
      const empty = document.createElement('div');
      empty.className = 'chat-empty';
      empty.innerHTML = `${ICONS.chat}<span>${q ? 'Tidak ada hasil' : 'Belum ada obrolan'}</span>`;
      dom.chatList.appendChild(empty);
      return;
    }

    for (const [label, arr] of groupChats(chats)) {
      const gl = document.createElement('div');
      gl.className = 'chat-group-label';
      gl.textContent = label;
      dom.chatList.appendChild(gl);

      for (const c of arr) {
        const item = document.createElement('div');
        item.className = 'chat-item' + (c.id === state.currentId ? ' active' : '');
        item.dataset.id = c.id;
        item.innerHTML = `
          <span class="ci-ico">${ICONS.chat}</span>
          <span class="ci-title">${MD.escape(c.title || 'Obrolan baru')}</span>
          <span class="ci-time">${relTime(c.updatedAt)}</span>
          <span class="ci-actions">
            <button class="ci-btn" data-act="rename" title="Ganti nama">${ICONS.pencil}</button>
            <button class="ci-btn" data-act="delete" title="Hapus">${ICONS.trash}</button>
          </span>`;
        dom.chatList.appendChild(item);
      }
    }
  }

  dom && null; // placeholder (dom diisi di init)

  function startRename(item, chat) {
    const titleEl = $('.ci-title', item);
    const input = document.createElement('input');
    input.className = 'ci-edit';
    input.value = chat.title || '';
    input.maxLength = 60;
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    const done = (save) => {
      if (save) {
        const v = input.value.trim();
        if (v) chat.title = v;
      }
      persistChats();
      renderChatList();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(true);
      if (e.key === 'Escape') done(false);
      e.stopPropagation();
    });
    input.addEventListener('blur', () => done(true));
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  // ==================================================================
  // 8. MODEL PICKER
  // ==================================================================
  function renderModelPicker() {
    const m = currentModel();
    dom.modelLabel.textContent = m.name;
    dom.modelIco.innerHTML = ICONS[m.icon] || ICONS.gem;

    dom.modelMenu.innerHTML = '';
    for (const m2 of CFG.MODELS) {
      const it = document.createElement('button');
      it.className = 'model-item' + (m2.id === m.id ? ' selected' : '');
      it.setAttribute('role', 'option');
      it.dataset.id = m2.id;
      it.innerHTML = `
        <span class="mi-ico">${ICONS[m2.icon] || ICONS.gem}</span>
        <span class="mi-body">
          <span class="mi-top"><span class="mi-name">${m2.name}</span><span class="badge badge-${m2.badgeColor}">${m2.badge}</span></span>
          <span class="mi-desc">${m2.desc}</span>
        </span>
        <span class="mi-check">${ICONS.check}</span>`;
      dom.modelMenu.appendChild(it);
    }
  }

  function selectModel(id) {
    state.settings.model = id;
    persistSettings();
    const chat = currentChat();
    if (chat) chat.model = id;
    persistChats();
    renderModelPicker();
    closeModelMenu();
    toast('Model: ' + getModel(id).name, 'info', 1600);
  }

  function closeModelMenu() {
    dom.modelMenu.classList.remove('open');
    dom.modelBtn.setAttribute('aria-expanded', 'false');
  }

  // ==================================================================
  // 9. LAMPIRAN (gambar / PDF / audio)
  // ==================================================================
  const ACCEPT_IMAGE = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

  function attachmentsTotalBytes() {
    return state.attachments.reduce((s, a) => s + (a._dataUrl ? a._dataUrl.length * 0.75 : a.size), 0);
  }

  async function addFiles(fileList) {
    const files = [...fileList];
    for (const f of files) {
      if (state.attachments.length >= CFG.LIMITS.MAX_ATTACHMENTS) {
        toast(`Maksimal ${CFG.LIMITS.MAX_ATTACHMENTS} lampiran per pesan.`, 'error');
        break;
      }
      const isImg = ACCEPT_IMAGE.includes(f.type);
      const isDoc = f.type === 'application/pdf';
      const isAudio = f.type.startsWith('audio/');

      if (!isImg && !isDoc && !isAudio) {
        toast(`"${f.name}" tidak didukung (gunakan gambar, PDF, atau audio).`, 'error');
        continue;
      }
      if (!isImg && f.size > CFG.LIMITS.MAX_FILE_BYTES) {
        toast(`"${f.name}" terlalu besar (maks ${fmtBytes(CFG.LIMITS.MAX_FILE_BYTES)}).`, 'error');
        continue;
      }
      if (attachmentsTotalBytes() > CFG.LIMITS.MAX_TOTAL_BYTES) {
        toast('Total lampiran terlalu besar. Kurangi ukuran atau jumlah file.', 'error');
        continue;
      }
      try {
        if (isImg) {
          const att = await processImage(f);
          state.attachments.push(att);
        } else {
          const dataUrl = await readAsDataURL(f);
          state.attachments.push({
            kind: isAudio ? 'audio' : 'pdf',
            name: f.name, mime: f.type, size: f.size,
            _dataUrl: dataUrl,
          });
        }
      } catch {
        toast(`Gagal memproses "${f.name}".`, 'error');
      }
    }
    renderAttachRow();
    updateSendState();
  }

  function readAsDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  /** Gambar → resize sisi terpanjang ≤1600px (JPEG) + thumbnail untuk riwayat. */
  async function processImage(file) {
    // GIF kecil: biarkan apa adanya (pertahankan animasi)
    if (file.type === 'image/gif' && file.size <= 6 * 1024 * 1024) {
      const dataUrl = await readAsDataURL(file);
      return {
        kind: 'image', name: file.name, mime: file.type, size: file.size,
        _dataUrl: dataUrl, _thumb: dataUrl,
      };
    }

    const bmp = await loadImage(file);
    const maxDim = CFG.LIMITS.MAX_IMAGE_DIM;
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);

    const full = drawToDataUrl(bmp, w, h, CFG.LIMITS.IMAGE_QUALITY);

    // Thumbnail untuk riwayat (hemat localStorage)
    const tScale = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
    const thumb = tScale < 1 || file.size > 400 * 1024
      ? drawToDataUrl(bmp, Math.round(bmp.width * tScale), Math.round(bmp.height * tScale), 0.72)
      : full;

    return {
      kind: 'image', name: file.name, mime: 'image/jpeg', size: file.size,
      _dataUrl: full, _thumb: thumb,
    };
  }

  function loadImage(file) {
    return new Promise((res, rej) => {
      if (window.createImageBitmap) {
        createImageBitmap(file).then(res).catch(() => {
          fallbackImg(file).then(res, rej);
        });
      } else {
        fallbackImg(file).then(res, rej);
      }
    });
  }
  function fallbackImg(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }
  function drawToDataUrl(src, w, h, q) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; // latar PNG transparan → putih
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    return cv.toDataURL('image/jpeg', q);
  }

  function renderAttachRow() {
    dom.attachRow.innerHTML = '';
    dom.attachRow.hidden = state.attachments.length === 0;

    for (const [i, a] of state.attachments.entries()) {
      const chip = document.createElement('div');
      chip.className = 'chip';
      const preview = a.kind === 'image'
        ? `<img src="${a._thumb || a._dataUrl}" alt="">`
        : `<span class="chip-file">${a.kind === 'audio' ? ICONS.audio : ICONS.file}</span>`;
      chip.innerHTML = `
        ${preview}
        <span class="chip-info">
          <span class="chip-name">${MD.escape(a.name)}</span>
          <span class="chip-size">${fmtBytes(a.size)}</span>
        </span>
        <button class="chip-remove" data-i="${i}" title="Hapus lampiran">${ICONS.x}</button>`;
      dom.attachRow.appendChild(chip);
    }
  }

  // ==================================================================
  // 10. RENDER PESAN
  // ==================================================================
  function scrollToBottom(force = false) {
    if (!state.stick && !force) return;
    dom.scroller.scrollTop = dom.scroller.scrollHeight;
  }

  function renderMessages() {
    const chat = currentChat();
    dom.messages.innerHTML = '';

    const hasMsgs = chat && chat.messages.length;
    dom.welcome.style.display = hasMsgs ? 'none' : '';

    if (!hasMsgs) return;

    for (const m of chat.messages) {
      dom.messages.appendChild(buildMessageEl(m, chat));
    }
    requestAnimationFrame(() => scrollToBottom(true));
  }

  function buildMessageEl(m, chat) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (m.role === 'user' ? 'user' : 'model');
    wrap.dataset.id = m.id;

    if (m.role === 'user') {
      // ---- pesan pengguna (kanan) ----
      const inner = document.createElement('div');
      inner.className = 'msg-inner';

      const bubble = document.createElement('div');
      bubble.className = 'bubble';

      if (m.attachments?.length) {
        const grid = document.createElement('div');
        grid.className = 'attachments-grid';
        for (const a of m.attachments) {
          if (a.kind === 'image' && a.thumb) {
            const img = document.createElement('img');
            img.src = a.thumb;
            img.alt = a.name || 'gambar';
            img.loading = 'lazy';
            img.addEventListener('click', () => openLightbox(a.thumb, a.name));
            grid.appendChild(img);
          } else {
            const f = document.createElement('div');
            f.className = 'att-file';
            f.innerHTML = `${a.kind === 'audio' ? ICONS.audio : ICONS.file}<span>${MD.escape(a.name || 'file')}</span>`;
            grid.appendChild(f);
          }
        }
        bubble.appendChild(grid);
      }

      if (m.text) {
        const txt = document.createElement('div');
        txt.className = 'msg-text plain';
        txt.textContent = m.text;
        bubble.appendChild(txt);
      }
      inner.appendChild(bubble);

      const actions = document.createElement('div');
      actions.className = 'msg-actions';
      actions.innerHTML = `<button class="act-btn" data-act="copy" title="Salin">${ICONS.copy}</button>`;
      inner.appendChild(actions);

      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      meta.textContent = fmtClock(m.ts);
      inner.appendChild(meta);

      wrap.appendChild(inner);
      return wrap;
    }

    // ---- pesan model (kiri, dengan avatar) ----
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = `<svg viewBox="0 0 64 64" width="100%" height="100%"><defs><linearGradient id="ag-${m.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="0.5" stop-color="#7c6cf0"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><path d="M32 4 L54 20 L46 56 L18 56 L10 20 Z" fill="url(#ag-${m.id})"/><path d="M32 4 L44 20 L32 26 L20 20 Z" fill="#fff" opacity="0.55"/><path d="M10 20 L20 20 L32 26 L24 56 L18 56 Z" fill="#000" opacity="0.2"/></svg>`;
    wrap.appendChild(avatar);

    const inner = document.createElement('div');
    inner.className = 'msg-inner';

    const txt = document.createElement('div');
    txt.className = 'msg-text';
    txt.appendChild(MD.render(m.text || ''));
    if (m.error) {
      const errBox = document.createElement('div');
      errBox.className = 'msg-error';
      errBox.innerHTML = `<strong>Ups, ada masalah.</strong><br>${MD.escape(m.error)}`;
      txt.appendChild(errBox);
    }
    inner.appendChild(txt);

    if (m.images?.length) {
      const imgs = document.createElement('div');
      imgs.className = 'msg-images';
      for (const du of m.images) {
        const img = document.createElement('img');
        img.src = du;
        img.alt = 'Gambar hasil Onyx AI';
        img.loading = 'lazy';
        img.addEventListener('click', () => openLightbox(du));
        imgs.appendChild(img);
      }
      inner.appendChild(imgs);
    }

    const isLastModel = chat && chat.messages[chat.messages.length - 1]?.id === m.id;
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    actions.innerHTML =
      `<button class="act-btn" data-act="copy" title="Salin">${ICONS.copy}</button>` +
      (isLastModel && !state.generating
        ? `<button class="act-btn" data-act="regen" title="Regenerasi">${ICONS.regen}</button>` : '');
    inner.appendChild(actions);

    if (m.meta) {
      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      const parts = [];
      if (m.meta.ms) parts.push(fmtDur(m.meta.ms));
      if (m.meta.tokens) parts.push(fmtNum(m.meta.tokens) + ' token');
      meta.textContent = parts.join(' · ');
      if (parts.length) inner.appendChild(meta);
    }

    wrap.appendChild(inner);
    return wrap;
  }

  /** Indikator mengetik untuk placeholder respons. */
  function buildThinkingEl(label = 'Onyx sedang berpikir') {
    const el = document.createElement('div');
    el.className = 'thinking';
    el.innerHTML = `<span class="typing"><i></i><i></i><i></i></span><span class="think-label">${MD.escape(label)}</span>`;
    return el;
  }

  // ==================================================================
  // 11. GEMINI API
  // ==================================================================
  function apiKey() {
    return (state.settings.apiKey || '').trim() || CFG.API_KEY;
  }

  function friendlyApiError(status, message) {
    const msg = (message || '').toLowerCase();
    if (status === 400 && msg.includes('api key')) return 'API key tidak valid. Periksa kembali di menu Pengaturan.';
    if (status === 401 || status === 403) return 'Akses ditolak — API key tidak valid atau tidak punya izin untuk model ini.';
    if (status === 404) return 'Model tidak ditemukan atau belum tersedia untuk key ini. Coba model lain.';
    if (status === 429) return 'Batas kuota/rate limit tercapai. Tunggu sebentar lalu coba lagi.';
    if (status >= 500) return 'Server Gemini sedang sibuk (error ' + status + '). Coba lagi beberapa saat.';
    return 'Terjadi error (' + status + '): ' + (message || 'tidak diketahui');
  }

  async function readApiError(res) {
    let message = '';
    try {
      const j = await res.json();
      message = j?.error?.message || '';
    } catch { /* bukan JSON */ }
    const err = new Error(friendlyApiError(res.status, message));
    err.friendly = true;
    return err;
  }

  /**
   * Panggil streaming (SSE). onDelta(text) dipanggil tiap potongan teks,
   * onImage({mimeType,data}) untuk hasil gambar, onMeta untuk usage.
   */
  async function callGeminiStream(modelId, payload, { onDelta, onImage, onMeta, signal }) {
    const res = await fetch(`${CFG.API_BASE}/models/${modelId}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw await readApiError(res);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }

        const cand = ev.candidates?.[0];
        for (const p of cand?.content?.parts || []) {
          if (p.thought) continue; // ringkasan berpikir → lewati
          if (p.text) onDelta?.(p.text);
          if (p.inlineData) onImage?.(p.inlineData);
        }
        if (ev.usageMetadata) onMeta?.(ev.usageMetadata);
        if (cand?.finishReason === 'MAX_TOKENS') {
          onDelta?.('\n\n*(Jawaban terpotong karena mencapai batas token maksimum.)*');
        }
        if (cand?.finishReason === 'SAFETY' || cand?.finishReason === 'PROHIBITED_CONTENT') {
          onDelta?.('\n\n*(Bagian respons diblokir filter keamanan.)*');
        }
      }
    }
  }

  /** Panggil non-streaming (untuk model gambar & judul otomatis). */
  async function callGeminiOnce(modelId, payload) {
    const res = await fetch(`${CFG.API_BASE}/models/${modelId}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await readApiError(res);
    return res.json();
  }

  /** Susun `contents` dari riwayat obrolan (hingga indeks tertentu). */
  function buildContents(chat, upTo) {
    const contents = [];
    chat.messages.forEach((m, i) => {
      if (i > upTo) return;
      if (m.role === 'user') {
        const parts = [];
        if (m.text && m.text.trim()) parts.push({ text: m.text });
        for (const a of m.attachments || []) {
          const src = a._dataUrl || a.thumb; // penuh saat sesi aktif, thumb setelah reload
          if (!src) continue;
          const mime = a._dataUrl ? a.mime : (a.mime === 'image/gif' ? 'image/gif' : 'image/jpeg');
          parts.push({ inlineData: { mimeType: mime, data: b64FromDataUrl(src) } });
        }
        if (parts.length) contents.push({ role: 'user', parts });
      } else {
        let text = (m.text || '').trim();
        if (!text) text = m.images?.length ? '(Gambar berhasil dibuat.)' : '…';
        contents.push({ role: 'model', parts: [{ text }] });
      }
    });
    return contents;
  }

  function buildPayload(model, contents, extraGen = {}) {
    const gen = {
      temperature: state.settings.temperature,
      ...extraGen,
    };
    const payload = {
      contents,
      generationConfig: gen,
    };
    if (state.settings.systemPrompt?.trim()) {
      payload.systemInstruction = { parts: [{ text: state.settings.systemPrompt.trim() }] };
    }
    return payload;
  }

  // ==================================================================
  // 12. KIRIM / STREAM / REGENERASI
  // ==================================================================
  function setGenerating(on) {
    state.generating = on;
    dom.btnSend.classList.toggle('sending', on);
    dom.btnSend.disabled = false; // tombol jadi stop saat generating
    dom.btnSend.title = on ? 'Hentikan (Esc)' : 'Kirim (Enter)';
    dom.composer.classList.toggle('busy', on);
  }

  function updateSendState() {
    if (state.generating) return; // saat generating tombol = stop (selalu aktif)
    const has = dom.input.value.trim() || state.attachments.length;
    dom.btnSend.disabled = !has;
  }

  async function sendMessage() {
    if (state.generating) return;
    const text = dom.input.value.trim();
    if (!text && !state.attachments.length) return;

    // Buat / ambil obrolan
    let chat = currentChat();
    if (!chat) {
      chat = newChat();
    }

    const now = Date.now();
    const userMsg = {
      id: uid(), role: 'user', text, ts: now,
      attachments: state.attachments.map((a) => ({
        kind: a.kind, name: a.name, mime: a.mime, size: a.size,
        thumb: a.kind === 'image' ? (a._thumb || null) : null,
        _dataUrl: a._dataUrl, // hanya di RAM (tidak dipersist)
      })),
    };
    chat.messages.push(userMsg);
    chat.updatedAt = now;
    if (!chat.title) chat.title = text ? (text.slice(0, 48) + (text.length > 48 ? '…' : '')) : 'Lampiran';
    renderChatList();

    // Reset composer
    dom.input.value = '';
    autosize();
    state.attachments = [];
    renderAttachRow();
    updateSendState();

    // Render pesan user + placeholder model
    dom.welcome.style.display = 'none';
    dom.messages.appendChild(buildMessageEl(userMsg, chat));
    const modelMsg = {
      id: uid(), role: 'model', text: '', ts: Date.now(), meta: null, images: [],
    };
    const placeholder = buildMessageEl(modelMsg, chat);
    const txtEl = $('.msg-text', placeholder);
    txtEl.innerHTML = '';
    txtEl.appendChild(buildThinkingEl());
    dom.messages.appendChild(placeholder);
    state.stick = true;
    scrollToBottom(true);

    await runGeneration(chat, modelMsg, placeholder);
  }

  async function runGeneration(chat, modelMsg, placeholderEl) {
    const model = getModel(chat.model || state.settings.model);
    chat.model = model.id;

    setGenerating(true);
    state.ctrl = new AbortController();
    state.stoppedByUser = false;
    const started = Date.now();

    let timer = setTimeout(() => {
      state.stoppedByUser = false;
      state.ctrl.abort('timeout');
    }, 240000);

    const txtEl = $('.msg-text', placeholderEl);
    const inner = $('.msg-inner', placeholderEl);
    let gotFirst = false;
    let renderPending = false;
    let lastRender = 0;

    const flush = () => {
      renderPending = false;
      txtEl.classList.add('streaming');
      txtEl.innerHTML = '';
      txtEl.appendChild(MD.render(modelMsg.text || ''));
      if (state.stick) scrollToBottom();
    };
    const scheduleRender = () => {
      if (renderPending) return;
      renderPending = true;
      const wait = Math.max(0, 90 - (performance.now() - lastRender));
      setTimeout(() => { lastRender = performance.now(); flush(); }, wait);
    };

    const onDelta = (t) => {
      if (!gotFirst) {
        gotFirst = true;
        txtEl.innerHTML = '';
      }
      modelMsg.text += t;
      scheduleRender();
    };
    const onImage = (inlineData) => {
      const du = `data:${inlineData.mimeType};base64,${inlineData.data}`;
      modelMsg.images.push(du);
    };
    const onMeta = (u) => { modelMsg.meta = modelMsg.meta || {}; modelMsg.meta.tokens = u.totalTokenCount; };

    try {
      const contents = buildContents(chat, chat.messages.length - 1); // tanpa placeholder model
      const payload = buildPayload(
        model.id,
        contents,
        model.imageOut ? { responseModalities: ['TEXT', 'IMAGE'] } : {}
      );

      if (model.imageOut) {
        txtEl.innerHTML = '';
        txtEl.appendChild(buildThinkingEl('Onyx sedang melukis'));
        await sleep(30);
      }

      if (model.imageOut) {
        // Model gambar → non-streaming
        const j = await callGeminiOnce(model.id, payload);
        for (const p of j.candidates?.[0]?.content?.parts || []) {
          if (p.thought) continue;
          if (p.text) { modelMsg.text += p.text; gotFirst = true; }
          if (p.inlineData) onImage(p.inlineData);
        }
        if (j.usageMetadata) onMeta(j.usageMetadata);
        flush();
      } else {
        await callGeminiStream(model.id, payload, { onDelta, onImage, onMeta, signal: state.ctrl.signal });
      }

      modelMsg.meta = modelMsg.meta || {};
      modelMsg.meta.ms = Date.now() - started;
      clearTimeout(timer);
      finishGeneration(chat, modelMsg, placeholderEl, false);
    } catch (err) {
      clearTimeout(timer);
      const aborted = err?.name === 'AbortError';
      if (aborted && state.stoppedByUser && (modelMsg.text || modelMsg.images.length)) {
        modelMsg.meta = modelMsg.meta || {};
        modelMsg.meta.ms = Date.now() - started;
        finishGeneration(chat, modelMsg, placeholderEl, true);
      } else if (aborted) {
        // dibatalkan / timeout tanpa isi → buang placeholder
        placeholderEl.remove();
        chat.updatedAt = Date.now();
        persistChats();
        renderChatList();
        toast(state.stoppedByUser ? 'Dihentikan.' : 'Waktu tunggu habis (4 menit). Coba lagi.', 'info', 2200);
        setGenerating(false);
        state.ctrl = null;
      } else {
        const msg = err?.friendly
          ? err.message
          : 'Gagal terhubung ke Gemini: ' + (err?.message || 'periksa koneksi internetmu.');
        modelMsg.error = msg;
        txtEl.classList.remove('streaming');
        txtEl.innerHTML = '';
        txtEl.appendChild(MD.render(modelMsg.text || ''));
        const errBox = document.createElement('div');
        errBox.className = 'msg-error';
        errBox.innerHTML = `<strong>Ups, ada masalah.</strong><br>${MD.escape(msg)}`;
        txtEl.appendChild(errBox);
        inner.appendChild(buildRetryNote());

        // simpan pesan error agar bisa diregenerasi setelahnya
        chat.messages.push({
          id: modelMsg.id, role: 'model', text: modelMsg.text || '',
          ts: Date.now(), meta: modelMsg.meta || null,
          images: modelMsg.images.length ? modelMsg.images : undefined,
          error: msg,
        });
        chat.updatedAt = Date.now();
        setGenerating(false);
        state.ctrl = null;
        persistChats();
        renderChatList();
      }
    }
  }

  function buildRetryNote() {
    const note = document.createElement('div');
    note.className = 'msg-meta';
    note.textContent = 'Klik tombol ↻ di bawah untuk mencoba lagi';
    return note;
  }

  function finishGeneration(chat, modelMsg, placeholderEl, stopped = false) {
    const txtEl = $('.msg-text', placeholderEl);
    txtEl.classList.remove('streaming');
    txtEl.innerHTML = '';
    txtEl.appendChild(MD.render(modelMsg.text || (stopped ? '_(dihentikan)_' : '_(tidak ada jawaban)_')));

    const clean = {
      id: modelMsg.id,
      role: 'model',
      text: modelMsg.text || (stopped ? '_(dihentikan)_' : '_(tidak ada jawaban)_'),
      ts: Date.now(),
      meta: modelMsg.meta || null,
      images: modelMsg.images.length ? modelMsg.images : undefined,
    };
    chat.messages.push(clean);
    if (clean.images?.length) compressForStorage(clean.images); // hemat localStorage

    chat.updatedAt = Date.now();
    setGenerating(false);
    state.ctrl = null;
    persistChats();
    renderChatList();
    renderMessages(); // re-render penuh agar tombol regenerasi muncul
    dom.input.focus();

    // judul otomatis setelah pertukaran pertama
    if (chat.messages.length <= 3 && !chat.titleLocked) autoTitle(chat);
  }

  /** Kompres gambar generate (>1MB) agar hemat localStorage. */
  function compressForStorage(images) {
    images.forEach((du, i) => {
      if (du.length < 700 * 1024) return;
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1024 / Math.max(img.width, img.height));
        const out = drawToDataUrl(img, Math.round(img.width * s), Math.round(img.height * s), 0.86);
        images[i] = out;
        // perbarui tampilan jika masih ada
        const els = $$(`.msg[data-id] img`);
        els.forEach((el) => { if (el.src === du) el.src = out; });
        persistChats();
      };
      img.src = du;
    });
  }

  async function autoTitle(chat) {
    const firstUser = chat.messages.find((m) => m.role === 'user');
    const firstModel = chat.messages.find((m) => m.role === 'model');
    if (!firstUser) return;

    try {
      const payload = {
        contents: [{
          role: 'user',
          parts: [{
            text:
              'Buat judul singkat untuk obrolan berikut. Maksimal 5 kata, dalam bahasa yang sama dengan pengguna, tanpa tanda kutip, tanpa titik di akhir, tanpa embel-embel.\n\n' +
              'Pesan pengguna: "' + (firstUser.text || '(lampiran)').slice(0, 400) + '"\n\n' +
              'Balasan asisten: "' + (firstModel?.text || '').slice(0, 300) + '"\n\n' +
              'Jawab HANYA judulnya:',
          }],
        }],
        generationConfig: { temperature: 0.3 },
      };
      const j = await callGeminiOnce(CFG.TITLE_MODEL, payload);
      let t = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
      t = t.replace(/["“”'`*#\n]/g, '').trim().slice(0, 60);
      if (t) {
        chat.title = t;
        chat.titleLocked = true;
        persistChats();
        renderChatList();
      }
    } catch { /* biarkan judul fallback */ }
  }

  function stopGeneration() {
    if (!state.generating || !state.ctrl) return;
    state.stoppedByUser = true;
    state.ctrl.abort('user');
  }

  async function regenerate() {
    if (state.generating) return;
    const chat = currentChat();
    if (!chat) return;

    // buang pesan model terakhir
    const last = chat.messages[chat.messages.length - 1];
    if (!last || last.role !== 'model') return;
    chat.messages.pop();

    // pastikan ada pesan user
    if (!chat.messages.length || chat.messages[chat.messages.length - 1].role !== 'user') {
      renderMessages();
      return;
    }

    renderMessages();

    const modelMsg = { id: uid(), role: 'model', text: '', ts: Date.now(), meta: null, images: [] };
    const placeholder = buildMessageEl(modelMsg, chat);
    const txtEl = $('.msg-text', placeholder);
    txtEl.innerHTML = '';
    txtEl.appendChild(buildThinkingEl());
    dom.messages.appendChild(placeholder);
    scrollToBottom(true);

    await runGeneration(chat, modelMsg, placeholder);
  }

  // ==================================================================
  // 13. OBROLAN BARU / BUKA / HAPUS
  // ==================================================================
  function newChat(silent = false) {
    const chat = {
      id: uid(),
      title: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: state.settings.model,
      messages: [],
    };
    state.chats.unshift(chat);
    state.currentId = chat.id;
    persistChats();
    renderChatList();
    renderMessages();
    closeSidebar();
    if (!silent) dom.input.focus();
    return chat;
  }

  function openChat(id) {
    if (state.currentId === id) { closeSidebar(); return; }
    state.currentId = id;
    const chat = currentChat();
    if (chat?.model) {
      const m = getModel(chat.model);
      if (m.id !== state.settings.model) {
        state.settings.model = m.id; // ikuti model obrolan
        persistSettings();
        renderModelPicker();
      }
    }
    renderChatList();
    renderMessages();
    state.stick = true;
    closeSidebar();
  }

  async function deleteChat(id) {
    const chat = state.chats.find((c) => c.id === id);
    if (!chat) return;
    const ok = await uiConfirm({
      title: 'Hapus obrolan ini?',
      message: `"${chat.title || 'Obrolan tanpa judul'}" akan dihapus permanen.`,
    });
    if (!ok) return;
    state.chats = state.chats.filter((c) => c.id !== id);
    if (state.currentId === id) {
      state.currentId = state.chats[0]?.id || null;
      renderMessages();
    }
    persistChats();
    renderChatList();
    toast('Obrolan dihapus.', 'success', 1800);
  }

  // ==================================================================
  // 14. LIGHTBOX
  // ==================================================================
  function openLightbox(src, name) {
    dom.lightboxImg.src = src;
    dom.lightboxDl.href = src;
    dom.lightboxDl.download = (name || 'onyx-ai') + (src.startsWith('data:image/png') ? '.png' : '.jpg');
    dom.lightbox.hidden = false;
    requestAnimationFrame(() => dom.lightbox.classList.add('show'));
  }
  function closeLightbox() {
    dom.lightbox.classList.remove('show');
    setTimeout(() => { dom.lightbox.hidden = true; dom.lightboxImg.src = ''; }, 220);
  }

  // ==================================================================
  // 15. PENGATURAN
  // ==================================================================
  function openSettings() {
    syncSettingsUI();
    dom.settingsModal.hidden = false;
    requestAnimationFrame(() => dom.settingsModal.classList.add('open'));
    closeSidebar();
  }
  function closeSettings() {
    dom.settingsModal.classList.remove('open');
    setTimeout(() => { dom.settingsModal.hidden = true; }, 220);
  }
  function syncSettingsUI() {
    $$('#themeSeg button').forEach((b) => {
      b.classList.toggle('on', b.dataset.val === state.settings.theme);
      b.setAttribute('aria-checked', b.dataset.val === state.settings.theme);
    });
    $('#tempRange').value = state.settings.temperature;
    $('#tempHint').textContent = tempLabel(state.settings.temperature);
    $('#sysPrompt').value = state.settings.systemPrompt;
    $('#apiKeyInput').value = state.settings.apiKey || '';
  }
  function tempLabel(t) {
    if (t <= 0.35) return `Presisi (${t.toFixed(2).replace('.', ',')})`;
    if (t >= 1.3) return `Kreatif (${t.toFixed(2).replace('.', ',')})`;
    return `Seimbang (${t.toFixed(2).replace('.', ',')})`;
  }

  function exportChats() {
    const data = {
      app: 'Onyx AI', exportedAt: new Date().toISOString(), chats: state.chats,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `onyx-ai-obrolan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Obrolan diekspor.', 'success');
  }

  // ==================================================================
  // 16. SIDEBAR MOBILE
  // ==================================================================
  function openSidebar() {
    dom.sidebar.classList.add('open');
    dom.backdrop.classList.add('show');
  }
  function closeSidebar() {
    dom.sidebar.classList.remove('open');
    dom.backdrop.classList.remove('show');
  }

  // ==================================================================
  // 17. COMPOSER BEHAVIOR
  // ==================================================================
  function autosize() {
    dom.input.style.height = 'auto';
    dom.input.style.height = Math.min(dom.input.scrollHeight, 200) + 'px';
  }

  // ==================================================================
  // 18. SARAN PEMBUKA
  // ==================================================================
  const SUGGESTIONS = [
    { icon: '✍️', title: 'Tulis email lamaran kerja', sub: 'yang profesional untuk fresh graduate' },
    { icon: '🧠', title: 'Jelaskan cara kerja AI', sub: 'seperti menjelaskan ke anak SMP' },
    { icon: '🧑‍💻', title: 'Buatkan web to-do list', sub: 'dengan HTML, CSS, dan JavaScript' },
    { icon: '📊', title: 'Rencana belajar 30 hari', sub: 'untuk menguasai dasar Python' },
    { icon: '🎨', title: 'Gambar kucing astronot', sub: 'generate gambar dengan Onyx Canvas', model: 'gemini-3.1-flash-image' },
    { icon: '📎', title: 'Analisis gambar / PDF', sub: 'lampirkan file lalu tanya apa saja', fillOnly: true },
  ];

  function renderSuggestions() {
    dom.suggestGrid.innerHTML = '';
    for (const s of SUGGESTIONS) {
      const card = document.createElement('button');
      card.className = 'suggest-card';
      card.innerHTML = `<span class="sc-ico">${s.icon}</span>
        <span class="sc-body"><span class="sc-title">${MD.escape(s.title)}</span><span class="sc-sub">${MD.escape(s.sub)}</span></span>
        <svg class="sc-go" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>`;
      card.addEventListener('click', () => {
        if (s.model && getModel(s.model)) selectModel(s.model);
        dom.input.value = s.title + (s.fillOnly ? '' : ' — ' + s.sub);
        autosize();
        updateSendState();
        dom.input.focus();
        if (!s.fillOnly) sendMessage();
        else toast('Lampirkan file lewat tombol klip kiri bawah 📎', 'info', 3500);
      });
      dom.suggestGrid.appendChild(card);
    }
  }

  // ==================================================================
  // 19. EVENT GLOBAL (delegasi)
  // ==================================================================
  function bindEvents() {
    // --- sidebar ---
    dom.btnNewChat.addEventListener('click', () => newChat());
    dom.btnNewChatTop.addEventListener('click', () => newChat());
    dom.btnMenu.addEventListener('click', openSidebar);
    dom.btnCloseSidebar.addEventListener('click', closeSidebar);
    dom.backdrop.addEventListener('click', closeSidebar);
    dom.searchChats.addEventListener('input', () => {
      state.search = dom.searchChats.value;
      renderChatList();
    });

    dom.chatList.addEventListener('click', (e) => {
      const item = e.target.closest('.chat-item');
      if (!item) return;
      const chat = state.chats.find((c) => c.id === item.dataset.id);
      if (!chat) return;

      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'delete') { deleteChat(chat.id); return; }
      if (act === 'rename') { startRename(item, chat); return; }
      openChat(chat.id);
    });

    // --- tema & pengaturan ---
    dom.btnTheme.addEventListener('click', cycleTheme);
    dom.btnSettings.addEventListener('click', openSettings);
    $('#btnCloseSettings').addEventListener('click', closeSettings);
    dom.settingsModal.addEventListener('click', (e) => {
      if (e.target === dom.settingsModal) closeSettings();
    });
    $('#themeSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-val]');
      if (!b) return;
      state.settings.theme = b.dataset.val;
      persistSettings();
      applyTheme();
      syncSettingsUI();
    });
    $('#tempRange').addEventListener('input', (e) => {
      state.settings.temperature = parseFloat(e.target.value);
      $('#tempHint').textContent = tempLabel(state.settings.temperature);
    });
    $('#btnResetPrompt').addEventListener('click', () => {
      state.settings.systemPrompt = CFG.DEFAULT_SYSTEM_PROMPT;
      $('#sysPrompt').value = state.settings.systemPrompt;
      toast('Instruksi sistem dikembalikan ke default.', 'success', 2000);
    });
    $('#btnEyeKey').addEventListener('click', () => {
      const inp = $('#apiKeyInput');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    $('#btnSaveSettings').addEventListener('click', () => {
      state.settings.systemPrompt = $('#sysPrompt').value.trim() || CFG.DEFAULT_SYSTEM_PROMPT;
      state.settings.apiKey = $('#apiKeyInput').value.trim();
      persistSettings();
      closeSettings();
      toast('Pengaturan disimpan.', 'success', 1800);
    });
    $('#btnExport').addEventListener('click', exportChats);
    $('#btnClearAll').addEventListener('click', async () => {
      const ok = await uiConfirm({
        title: 'Hapus semua obrolan?',
        message: 'Seluruh riwayat obrolan akan dihapus permanen dari perangkat ini. Pertimbangkan ekspor dulu.',
        okText: 'Hapus Semua',
      });
      if (!ok) return;
      state.chats = [];
      state.currentId = null;
      persistChats();
      renderChatList();
      renderMessages();
      toast('Semua obrolan dihapus.', 'success', 2200);
    });

    // --- model picker ---
    dom.modelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dom.modelMenu.classList.contains('open');
      if (open) closeModelMenu();
      else {
        dom.modelMenu.classList.add('open');
        dom.modelBtn.setAttribute('aria-expanded', 'true');
      }
    });
    dom.modelMenu.addEventListener('click', (e) => {
      const it = e.target.closest('.model-item');
      if (it) selectModel(it.dataset.id);
    });
    document.addEventListener('click', (e) => {
      if (!dom.modelPicker.contains(e.target)) closeModelMenu();
    });

    // --- composer ---
    dom.btnSend.addEventListener('click', () => {
      if (state.generating) stopGeneration();
      else sendMessage();
    });
    dom.input.addEventListener('input', () => { autosize(); updateSendState(); });
    dom.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        sendMessage();
      }
    });
    dom.btnAttach.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', () => {
      addFiles(dom.fileInput.files);
      dom.fileInput.value = '';
    });

    // paste gambar dari clipboard
    document.addEventListener('paste', (e) => {
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    });

    // drag & drop
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => {
      if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
      dragDepth++;
      dom.dropOverlay.classList.add('show');
    });
    window.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) dom.dropOverlay.classList.remove('show');
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragDepth = 0;
      dom.dropOverlay.classList.remove('show');
      if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
    });

    // --- lampiran ---
    dom.attachRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip-remove');
      if (!btn) return;
      state.attachments.splice(parseInt(btn.dataset.i, 10), 1);
      renderAttachRow();
      updateSendState();
    });

    // --- aksi pesan (delegasi) ---
    dom.messages.addEventListener('click', async (e) => {
      // salin kode
      const cc = e.target.closest('.code-copy');
      if (cc) {
        const code = cc.closest('.code-block')?.querySelector('pre')?.textContent || '';
        await copyText(code);
        const label = cc.querySelector('span');
        const old = label.textContent;
        label.textContent = 'Tersalin!';
        cc.classList.add('ok');
        setTimeout(() => { label.textContent = old; cc.classList.remove('ok'); }, 1400);
        return;
      }
      // aksi pesan
      const act = e.target.closest('.act-btn')?.dataset.act;
      if (!act) return;
      const msgEl = e.target.closest('.msg');
      const chat = currentChat();
      if (!chat || !msgEl) return;
      const msg = chat.messages.find((m) => m.id === msgEl.dataset.id);
      if (!msg) return;

      if (act === 'copy') {
        await copyText(msg.text || '');
        toast('Disalin ke clipboard.', 'success', 1600);
      } else if (act === 'regen') {
        regenerate();
      }
    });

    // --- scroll ---
    dom.scroller.addEventListener('scroll', () => {
      const el = dom.scroller;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
      state.stick = nearBottom;
      dom.btnScrollDown.classList.toggle('show', !nearBottom);
    });
    dom.btnScrollDown.addEventListener('click', () => {
      state.stick = true;
      dom.scroller.scrollTo({ top: dom.scroller.scrollHeight, behavior: 'smooth' });
    });

    // --- lightbox ---
    $('.lb-close', dom.lightbox).addEventListener('click', closeLightbox);
    dom.lightbox.addEventListener('click', (e) => {
      if (e.target === dom.lightbox) closeLightbox();
    });

    // --- keyboard global ---
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        newChat();
      }
      if (e.key === 'Escape') {
        if (dom.lightbox.classList.contains('show')) closeLightbox();
        else if (state.generating) stopGeneration();
        else if (dom.settingsModal.classList.contains('open')) closeSettings();
        else if (dom.modelMenu.classList.contains('open')) closeModelMenu();
        else closeSidebar();
      }
    });
  }

  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  // ==================================================================
  // 20. LAYAR SETUP API KEY (saat key belum tersedia)
  // ==================================================================
  function ensureApiKey() {
    if (apiKey()) return;

    const wrap = document.createElement('div');
    wrap.className = 'modal open gate-modal';
    wrap.innerHTML = `
      <div class="modal-card small gate-card">
        <div class="gate-logo">
          <svg viewBox="0 0 64 64" width="52" height="52">
            <defs><linearGradient id="gg1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#a78bfa"/><stop offset="0.5" stop-color="#7c6cf0"/><stop offset="1" stop-color="#22d3ee"/>
            </linearGradient></defs>
            <path d="M32 4 L54 20 L46 56 L18 56 L10 20 Z" fill="url(#gg1)"/>
            <path d="M32 4 L44 20 L32 26 L20 20 Z" fill="#fff" opacity="0.55"/>
            <path d="M10 20 L20 20 L32 26 L24 56 L18 56 Z" fill="#000" opacity="0.2"/>
          </svg>
        </div>
        <h3 class="gate-title">Selamat datang di <span class="grad-text">Onyx&nbsp;AI</span></h3>
        <p class="gate-msg">Masukkan <strong>API key Google Gemini</strong>-mu untuk memulai.
        Key hanya disimpan di perangkat ini, tidak dikirim ke mana pun selain Google.</p>
        <div class="key-row">
          <input type="password" id="gateKey" placeholder="Tempel API key di sini…" autocomplete="off" spellcheck="false">
          <button class="icon-btn" id="gateEye" title="Tampilkan" aria-label="Tampilkan key">${'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>'}</button>
        </div>
        <p class="gate-err" id="gateErr" hidden>Key tidak boleh kosong.</p>
        <button class="primary-btn gate-go" id="gateGo">Mulai Ngobrol ✨</button>
        <a class="gate-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
          Dapatkan API key gratis di Google AI Studio →
        </a>
      </div>`;
    document.body.appendChild(wrap);

    const inp = $('#gateKey', wrap);
    const err = $('#gateErr', wrap);
    const submit = () => {
      const v = inp.value.trim();
      if (!v) {
        err.hidden = false;
        inp.focus();
        return;
      }
      state.settings.apiKey = v;
      persistSettings();
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 250);
      toast('API key tersimpan. Selamat menggunakan Onyx AI! 🎉', 'success', 2600);
      dom.input.focus();
    };
    $('#gateGo', wrap).addEventListener('click', submit);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    $('#gateEye', wrap).addEventListener('click', () => {
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    setTimeout(() => inp.focus(), 150);
  }

  // ==================================================================
  // 21. INIT
  // ==================================================================
  function init() {
    cacheDom();
    loadState();
    applyTheme();
    bindEvents();
    renderModelPicker();
    renderSuggestions();
    renderChatList();
    updateSendState();
    autosize();
    ensureApiKey();

    // buka obrolan terakhir jika ada
    if (state.chats.length) {
      const last = [...state.chats].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      state.currentId = last.id;
      if (last.model) state.settings.model = getModel(last.model).id;
      renderModelPicker();
      renderChatList();
      renderMessages();
    }

    // layar kecil: mulai dengan sidebar tertutup (default CSS)

    // service worker (PWA)
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(() => { });
    }

    dom.input.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
