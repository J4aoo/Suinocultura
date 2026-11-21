/* ==========================================================================
   pwa.js — instalação do app na tela inicial do celular
   - Android/Chrome: usa o convite nativo (beforeinstallprompt)
   - iPhone/iPad (Safari): mostra instruções passo a passo
   - Detecta quando já está rodando como aplicativo instalado
   ========================================================================== */
const PWA = (function () {
  'use strict';

  const DISMISS_KEY = 'granja.install.dismissed.v1';
  let promptEvento = null;
  let jaInstalado = false;

  function ehIOS() {
    const ua = navigator.userAgent || '';
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return { iOS, safari };
  }

  function rodandoComoApp() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.navigator.standalone === true;
  }

  function instaladoAntes() {
    try { return localStorage.getItem('granja.instalado') === '1'; } catch (_) { return false; }
  }

  function marcarInstalado() {
    try { localStorage.setItem('granja.instalado', '1'); } catch (_) {}
    jaInstalado = true;
  }

  function foiRecusado() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (_) { return false; }
  }

  /* ---------------- Registro do service worker ---------------- */

  function registrarSW() {
    if (!('serviceWorker' in navigator)) return;
    // O service worker só funciona em https (ou localhost).
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { scope: './' })
        .catch(err => console.warn('[pwa] service worker não registrado', err));
    });
  }

  /* ---------------- Convite nativo (Android / Chrome desktop) ---------------- */

  function capturarConvite() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      promptEvento = e;
      mostrarBotaoInstalar();
      // Em telas pequenas, oferece o convite de forma proativa (uma única vez).
      if (!foiRecusado() && !rodandoComoApp() && !instaladoAntes()) {
        setTimeout(() => { if (promptEvento) abrirGuia(); }, 2600);
      }
    });

    window.addEventListener('appinstalled', () => {
      marcarInstalado();
      promptEvento = null;
      esconderBotaoInstalar();
      if (UI && UI.toast) UI.toast('App instalado! Procure o ícone na tela inicial.', 'ok');
    });
  }

  function mostrarBotaoInstalar() {
    const btn = document.getElementById('btn-instalar');
    if (btn) btn.hidden = false;
  }
  function esconderBotaoInstalar() {
    const btn = document.getElementById('btn-instalar');
    if (btn) btn.hidden = true;
  }

  async function instalar() {
    if (promptEvento) {
      const evt = promptEvento;
      promptEvento = null;
      evt.prompt();
      try {
        const escolha = await evt.userChoice;
        if (escolha && escolha.outcome === 'accepted') {
          marcarInstalado();
          esconderBotaoInstalar();
          UI.toast('Instalando… o ícone aparecerá na tela inicial.', 'ok');
        } else {
          try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) {}
          UI.toast('Tudo bem! Você pode instalar depois pelo menu do navegador.');
        }
      } catch (_) { /* ignora */ }
      return;
    }
    abrirGuia();
  }

  /* ---------------- Guia manual (iPhone e navegadores sem convite) ---------------- */

  function passosIOS() {
    return {
      titulo: 'Instalar no iPhone / iPad',
      itens: [
        'Abra este site no <strong>Safari</strong> (no iPhone, o Chrome não instala apps).',
        'Toque no botão <strong>Compartilhar</strong> — o quadrado com uma flecha para cima, na barra inferior.',
        'Role a lista e toque em <strong>Adicionar à Tela de Início</strong>.',
        'Confirme em <strong>Adicionar</strong>. O ícone do porquinho aparece junto aos seus apps.'
      ]
    };
  }

  function passosAndroid() {
    return {
      titulo: 'Instalar no Android',
      itens: [
        'Abra este site no <strong>Chrome</strong>.',
        'Toque nos <strong>três pontinhos</strong> no canto superior direito.',
        'Toque em <strong>Instalar aplicativo</strong> (ou <strong>Adicionar à tela inicial</strong>).',
        'Confirme em <strong>Instalar</strong>.'
      ]
    };
  }

  function passosDesktop() {
    return {
      titulo: 'Instalar no computador',
      itens: [
        'No <strong>Chrome</strong> ou <strong>Edge</strong>, procure o ícone de instalação (uma telinha com seta) na barra de endereços.',
        'Ou abra o menu do navegador e escolha <strong>Instalar Granja</strong>.',
        'O app abrirá em uma janela própria, como um programa comum.'
      ]
    };
  }

  function abrirGuia() {
    if (jaInstalado || rodandoComoApp()) {
      UI.modal({
        title: 'Você já está usando como aplicativo',
        subtitle: 'Este site está aberto em modo aplicativo',
        body: '<p style="margin:0;color:var(--ink-700);font-size:14px">Tudo certo! Para abrir o app depois, procure o ícone ' +
          '<strong>Granja</strong> na tela inicial do seu celular — não precisa digitar o endereço novamente.</p>',
        footer: '<button class="btn btn-primary" data-close>Entendi</button>'
      });
      return;
    }

    const { iOS, safari } = ehIOS();
    const guia = iOS ? passosIOS() : (/Android/i.test(navigator.userAgent) ? passosAndroid() : passosDesktop());

    const avisoSafari = (iOS && !safari)
      ? '<div class="alert-item warn" style="margin-bottom:14px"><span class="ico" aria-hidden="true">⚠️</span>' +
        '<div><strong>Use o Safari</strong><span>No iPhone, apenas o Safari consegue adicionar o app à tela inicial.</span></div></div>'
      : '';

    UI.modal({
      title: guia.titulo,
      subtitle: 'Coloque o ícone da granja na tela inicial',
      body:
        '<div style="display:flex;gap:14px;align-items:center;margin-bottom:16px">' +
          '<img src="icons/app-icon-192.png" alt="" width="56" height="56" style="border-radius:14px;flex:0 0 56px">' +
          '<div><strong style="font-size:14px">Granja Suína</strong>' +
          '<div class="small muted">Abre em tela cheia, sem barra de endereço</div></div>' +
        '</div>' +
        avisoSafari +
        '<ol style="margin:0;padding-left:20px;font-size:13.5px;line-height:1.7;color:var(--ink-700)">' +
          guia.itens.map(p => '<li style="margin-bottom:8px">' + p + '</li>').join('') +
        '</ol>' +
        '<div class="hr"></div>' +
        '<p class="small muted" style="margin:0">Pronto! Depois de instalar, o app abre mesmo com internet fraca ' +
        '(a casca do aplicativo fica salva no aparelho). Os dados continuam sendo gravados no servidor quando há conexão.</p>',
      footer:
        '<button class="btn" data-nao-mostrar>Não mostrar mais</button>' +
        '<button class="btn btn-primary" data-close>Entendi</button>'
    });

    const root = document.getElementById('modal-root');
    const nao = root.querySelector('[data-nao-mostrar]');
    if (nao) nao.addEventListener('click', () => {
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) {}
      UI.closeModal();
      UI.toast('Tudo bem — o botão "Instalar app" continua no menu.');
    });
  }

  /* ---------------- Inicialização ---------------- */

  function init() {
    // Dentro do app Android (Capacitor) o app já está instalado:
    // nada de service worker nem convite de instalação.
    const C = window.Capacitor;
    if (C && C.isNativePlatform && C.isNativePlatform()) {
      jaInstalado = true;
      const b = document.getElementById('btn-instalar');
      if (b) b.hidden = true;
      return;
    }
    jaInstalado = instaladoAntes() || rodandoComoApp();
    registrarSW();
    capturarConvite();

    if (rodandoComoApp()) marcarInstalado();

    const btn = document.getElementById('btn-instalar');
    if (btn) {
      if (jaInstalado || rodandoComoApp()) btn.hidden = true;
      else btn.hidden = false;
      btn.addEventListener('click', instalar);
    }

    // Exibe o convite uma única vez para quem entra pelo celular e ainda não instalou.
    const { iOS } = ehIOS();
    const mobile = iOS || /Android/i.test(navigator.userAgent);
    if (mobile && !jaInstalado && !rodandoComoApp() && !foiRecusado()) {
      setTimeout(() => { if (!document.querySelector('.scrim')) abrirGuia(); }, 4200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    instalar, abrirGuia, get instalado() { return jaInstalado || rodandoComoApp(); }
  };
})();
