(() => {
  const panel = document.querySelector('[data-publish-panel]');
  const refresh = document.querySelector('[data-publish-refresh]');
  const state = panel.querySelector('[data-publish-state]');
  const detail = panel.querySelector('[data-publish-detail]');
  const logLink = panel.querySelector('[data-publish-log]');
  const runList = 'https://api.github.com/repos/linqopsx/linqopsx.github.io/actions/workflows/pages-deploy.yml/runs?branch=main&per_page=1';

  async function showPublication() {
    if (refresh.disabled) return;
    refresh.disabled = true;
    try {
      const response = await fetch(runList, {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error('Publication status unavailable');
      const data = await response.json();
      const run = data.workflow_runs?.[0];
      if (!run || !Number.isSafeInteger(run.id)) throw new Error('Publication information missing');
      logLink.href = 'https://github.com/linqopsx/linqopsx.github.io/actions/runs/' + run.id;
      if (run.status !== 'completed') {
        panel.dataset.state = 'running';
        state.textContent = '文章正在构建或发布';
        detail.textContent = '保存已提交到 GitHub，等待发布成功后再查看博客。';
      } else if (run.conclusion === 'success') {
        panel.dataset.state = 'success';
        state.textContent = '最近一次发布成功';
        detail.textContent = '本次更新已完成，可以打开博客检查文章。';
      } else if (run.conclusion === 'cancelled') {
        panel.dataset.state = 'cancelled';
        state.textContent = '最近一次发布已取消';
        detail.textContent = '可打开发布日志确认是否有新的任务正在处理。';
      } else {
        panel.dataset.state = 'failed';
        state.textContent = '最近一次发布失败';
        detail.textContent = '请打开发布日志，查看标红步骤中的报错。已保存的文章仍在 GitHub 仓库中。';
      }
    } catch {
      panel.dataset.state = 'unknown';
      state.textContent = '暂时无法读取发布状态';
      detail.textContent = '可以打开 GitHub 发布日志，查看最近一次任务的结果。';
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.addEventListener('click', showPublication);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) showPublication();
  });
  showPublication();
})();
