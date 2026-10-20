// This guard intentionally uses basic syntax so it can report application parse errors.
(function () {
  var panel = document.getElementById('startup');
  var message = document.getElementById('startup-message');
  var retry = document.getElementById('startup-retry');
  var initialized = false;
  var deadline;
  function retryURL() {
    var url = new URL(window.location.href);
    url.searchParams.set('reload', String(Date.now()));
    retry.href = url.href;
  }
  function failed(code) {
    clearTimeout(deadline);
    panel.hidden = false;
    document.documentElement.setAttribute('data-app-state', 'failed');
    message.textContent = '화면을 준비하는 중 문제가 생겼습니다. 다시 열기로 재시도해 주세요. 저장한 기본 명단은 유지됩니다. (' + code + ')';
    retryURL();
  }
  window.AttendanceStartup = {
    ready: function () {
      initialized = true;
      clearTimeout(deadline);
      panel.hidden = true;
      document.documentElement.setAttribute('data-app-state', 'ready');
    },
    failed: failed
  };
  retry.onclick = function (event) {
    if (initialized && !window.confirm('페이지를 다시 열면 오늘 선택과 작성 중인 글은 초기화됩니다. 다시 열까요?')) {
      event.preventDefault();
      return;
    }
    retryURL();
  };
  window.addEventListener('error', function (event) {
    var target = event.target;
    var resource = target && (target.src || target.href) || '';
    var appFile = /\/(app|roster)\.js(?:\?|$)/.test(resource || event.filename || '');
    var inlineApp = event.filename && event.filename.split('#')[0] === window.location.href.split('#')[0];
    if (appFile || (!initialized && inlineApp)) failed('실행 오류');
  }, true);
  window.addEventListener('pageshow', function (event) {
    if (event.persisted && !initialized) failed('복원 중단');
  });
  deadline = setTimeout(function () { if (!initialized) failed('시작 지연'); }, 8000);
  document.documentElement.setAttribute('data-app-state', 'starting');
  retryURL();
})();
