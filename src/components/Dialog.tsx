import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={ref} className={`dialog ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }} aria-label={title}>
    <div className="dialog-inner">
      <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭弹窗"><X size={20} /></button></div>
      {children}
    </div>
  </dialog>;
}
