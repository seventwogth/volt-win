import { useCallback, useEffect, useRef, useState } from 'react';
import { readImageBase64, dataUrlToBlobUrl } from '@api/image/imageApi';
import { Icon } from '@uikit/icon/Icon';
import styles from './ImageViewer.module.scss';

interface ImageViewerProps {
  voltPath: string;
  filePath: string;
}

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;

export function ImageViewer({ voltPath, filePath }: ImageViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [fitZoom, setFitZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Drag state
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollX: 0, scrollY: 0 });

  // Load image
  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const dataUrl = await readImageBase64(voltPath, filePath);
        if (cancelled) return;
        const url = dataUrlToBlobUrl(dataUrl);
        revoke = url;
        setBlobUrl(url);
        setZoom(1);
        setDimensions(null);
      } catch (e) {
        console.error('Failed to load image:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [voltPath, filePath]);

  // Calculate fit zoom once image loads
  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    setDimensions({ w: natW, h: natH });

    const padding = 40;
    const canvasW = canvas.clientWidth - padding * 2;
    const canvasH = canvas.clientHeight - padding * 2;
    const fit = Math.min(1, canvasW / natW, canvasH / natH);
    setFitZoom(fit);
    setZoom(fit);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
  }, []);

  const zoomFit = useCallback(() => {
    setZoom(fitZoom);
  }, [fitZoom]);

  const zoomActual = useCallback(() => {
    setZoom(1);
  }, []);

  // Mouse wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)));
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // Drag to pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollX: canvas.scrollLeft,
      scrollY: canvas.scrollTop,
    };
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      canvas.scrollLeft = dragStart.current.scrollX - dx;
      canvas.scrollTop = dragStart.current.scrollY - dy;
    };

    const handleMouseUp = () => setDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  const fileName = filePath.split('/').pop() ?? filePath;
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className={styles.viewer}>
      <div className={styles.toolbar}>
        <span className={styles.filename}>{fileName}</span>
        {dimensions && (
          <>
            <div className={styles.separator} />
            <span className={styles.dimensions}>
              {dimensions.w} x {dimensions.h}
            </span>
          </>
        )}
        <div className={styles.separator} />
        <button className={styles.toolbarBtn} onClick={zoomOut} title="Zoom out">
          <Icon name="zoomOut" size={16} />
        </button>
        <span className={styles.zoomLabel}>{zoomPercent}%</span>
        <button className={styles.toolbarBtn} onClick={zoomIn} title="Zoom in">
          <Icon name="zoomIn" size={16} />
        </button>
        <div className={styles.separator} />
        <button className={styles.toolbarBtn} onClick={zoomFit} title="Fit to view">
          <Icon name="maximize" size={16} />
        </button>
        <button className={styles.toolbarBtn} onClick={zoomActual} title="Actual size (100%)">
          1:1
        </button>
      </div>
      <div
        ref={canvasRef}
        className={`${styles.canvas} ${dragging ? styles.dragging : ''}`}
        onMouseDown={handleMouseDown}
      >
        {blobUrl && (
          <div
            className={styles.imageWrapper}
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              ref={imgRef}
              src={blobUrl}
              className={styles.image}
              onLoad={handleImageLoad}
              alt={fileName}
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
