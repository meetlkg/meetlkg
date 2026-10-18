// The project token is public, browser-side configuration, not an account API key.
(() => {
  const productionHosts = ['gok03.com', 'www.gok03.com'];
  if (!productionHosts.includes(window.location.hostname)) return;
  if (/^\/(?:admin|api|\.cms)(?:\/|$)/.test(window.location.pathname)) return;
  if (document.querySelector('meta[name="robots"][content*="noindex"]')) return;
  if (window.posthog?.__SV || window.posthog?.__loaded) return;

  // PostHog's asynchronous browser snippet. A blocked SDK never holds up the site.
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split('.');2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}p||((p=t.createElement('script')).type='text/javascript',p.crossOrigin='anonymous',p.async=!0,p.src=s.api_host.replace('.i.posthog.com','-assets.i.posthog.com')+'/static/array.js',p.onerror=function(){p=null},(r=t.getElementsByTagName('script')[0]).parentNode.insertBefore(p,r));var u=e;for(void 0!==a?u=e[a]=[]:a='posthog',u.people=u.people||[],Object.defineProperty(u,'toString',{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e='posthog';return'posthog'!==a&&(e+='.'+a),t||(e+=' (stub)'),e}}),Object.defineProperty(u.people,'toString',{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+'.people (stub)'}}),o='init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug'.split(' '),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  window.posthog.init('phc_ksisiq7wocPtan4u7NsGthjiqPHkbzhweFM6Arw3bHTd', {
    api_host: 'https://us.i.posthog.com',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-05-30',
    capture_pageview: true,
    capture_pageleave: true,
    person_profiles: 'identified_only',
    respect_dnt: true,
    autocapture: {
      dom_event_allowlist: ['click'],
      css_selector_ignorelist: [
        '.ph-no-autocapture', '[data-ph-no-autocapture]',
        '#avatar-transcript', '#avatar-question', 'input', 'textarea', '[contenteditable]'
      ],
      capture_copied_text: false
    },
    disable_session_recording: false,
    enable_recording_console_log: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '#avatar-transcript',
      recordBody: false,
      recordHeaders: false,
      recordCanvas: false,
      recordCrossOriginIframes: false
    }
  });

  // Useful portfolio events contain UI choices only, never typed questions.
  const capture = (name, properties = {}) => window.posthog.capture(name, properties);
  document.addEventListener('portfolio:chat-open', () => capture('portfolio_chat_opened'));
  document.addEventListener('portfolio:contact', event => capture('portfolio_contact_opened', {
    source: event.detail?.unresolved ? 'unanswered_question' : 'chat'
  }));
  document.addEventListener('click', event => {
    const target = event.target.closest?.('[data-topic], [data-chapter], [data-open-contact], #contact-card a');
    if (!target) return;
    if (target.dataset.topic) capture('portfolio_topic_selected', { topic: target.dataset.topic });
    else if (target.dataset.chapter) capture('portfolio_career_selected', { chapter: target.dataset.chapter });
    else if (target.hasAttribute('data-open-contact')) capture('portfolio_contact_opened', { source: 'say_hello' });
    else {
      const link = new URL(target.href);
      capture('portfolio_contact_clicked', {
        channel: link.protocol === 'mailto:' ? 'email' : link.protocol === 'tel:' ? 'phone' : link.hostname
      });
    }
  });
})();
