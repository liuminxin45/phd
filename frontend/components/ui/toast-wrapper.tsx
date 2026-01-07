import { useEffect } from 'react';

export function ToastWrapper() {
  useEffect(() => {
    const addSVGToToasts = () => {
      const toasts = document.querySelectorAll('[data-sonner-toast]');
      
      toasts.forEach((toast) => {
        // 检查是否已经添加过 SVG
        if (toast.querySelector('.toast-countdown-svg')) return;
        
        // 创建 SVG 元素
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('toast-countdown-svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.position = 'absolute';
        svg.style.inset = '-3px';
        svg.style.pointerEvents = 'none';
        svg.style.overflow = 'visible';
        
        // 创建圆角矩形路径
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '3');
        rect.setAttribute('y', '3');
        rect.setAttribute('width', 'calc(100% - 6px)');
        rect.setAttribute('height', 'calc(100% - 6px)');
        rect.setAttribute('rx', '9');
        rect.setAttribute('ry', '9');
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', '#10b981');
        rect.setAttribute('stroke-width', '3');
        rect.setAttribute('pathLength', '400');
        rect.setAttribute('stroke-dasharray', '400');
        rect.setAttribute('stroke-dashoffset', '400');
        rect.classList.add('toast-countdown-path');
        
        svg.appendChild(rect);
        toast.appendChild(svg);

        // Listen for animation end and trigger toast dismiss
        rect.addEventListener('animationend', () => {
          const dismissButton = toast.querySelector('[data-close-button]') as HTMLButtonElement;
          if (dismissButton) {
            dismissButton.click();
          } else {
            // Fallback: hide toast directly
            (toast as HTMLElement).style.opacity = '0';
            setTimeout(() => {
              (toast as HTMLElement).remove();
            }, 200);
          }
        });
      });
    };
    
    // 初始检查
    addSVGToToasts();
    
    // 使用 MutationObserver 监听新 toast 的添加
    const observer = new MutationObserver(() => {
      addSVGToToasts();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  return null;
}
