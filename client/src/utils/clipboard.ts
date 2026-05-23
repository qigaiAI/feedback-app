export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }
}

export function openWechat() {
  // Try to open WeChat via scheme
  const wechatUrl = 'weixin://';
  const start = Date.now();
  window.location.href = wechatUrl;
  // If after 2s we're still on the page, WeChat isn't installed
  setTimeout(() => {
    if (Date.now() - start < 2500) {
      // Still here, WeChat didn't open
    }
  }, 2000);
}
