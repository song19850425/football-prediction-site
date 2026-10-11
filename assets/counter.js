/* 站点访问计数器：优先使用在线计数服务，失败时降级到本机计数。
   用法：页面放置元素 id="counter-slot" 或任意 [data-counter] 属性元素即可。 */
(function () {
  var NS = 'song19850425-football-prediction-site';
  var KEY = 'site-views';
  var LS = 'fp_site_views_local';

  function targets() {
    return Array.prototype.slice.call(
      document.querySelectorAll('#counter-slot, [data-counter]')
    );
  }
  function setText(full, short) {
    targets().forEach(function (el) {
      el.textContent = (el.getAttribute('data-counter') === 'short') ? short : full;
    });
  }

  // 本机计数（localStorage），始终可用
  var localViews = 1;
  try {
    localViews = (parseInt(localStorage.getItem(LS) || '0', 10) || 0) + 1;
    localStorage.setItem(LS, String(localViews));
  } catch (e) { /* 隐私模式忽略 */ }

  setText('本站访问：统计中…', '统计中');

  var url = 'https://api.counterapi.dev/v1/' + NS + '/' + KEY + '/up';
  var done = false;
  var timer = setTimeout(function () {
    if (!done) setText('本机访问 ' + localViews + ' 次（在线计数超时）', String(localViews));
  }, 6000);

  if (window.fetch) {
    fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        done = true; clearTimeout(timer);
        var n = (d && (d.count != null ? d.count : d.value)) || null;
        if (n != null) setText('本站访问 ' + n + ' 次 · 本机第 ' + localViews + ' 次', n.toLocaleString());
        else setText('本机访问 ' + localViews + ' 次', String(localViews));
      })
      .catch(function () {
        done = true; clearTimeout(timer);
        setText('本机访问 ' + localViews + ' 次（在线计数不可用）', String(localViews));
      });
  } else {
    setText('本机访问 ' + localViews + ' 次', String(localViews));
  }

  // 暴露给页面手动渲染
  window.SiteCounter = {
    render: function (el) {
      if (!el) return;
      el.textContent = (el.getAttribute('data-counter') === 'short') ? String(localViews) : ('本机访问 ' + localViews + ' 次');
    }
  };
})();