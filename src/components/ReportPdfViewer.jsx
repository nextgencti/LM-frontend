import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Download, Printer, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, Mail, X, Lock } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Initialize PDF.js worker securely using Vite's native bundler resolution natively
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function ReportPdfViewer({ pdfBuffer, onClose, fileName, onEmail, onDeliver, isPublic = false, isEmailing = false, isRestricted = false, onRestrict, onLoadSuccess, onLoadError }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState(null);

  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    const measure = () => {
      const width = window.innerWidth;
      
      if (isPublic) {
        const padding = width < 640 ? 16 : 48;
        setContainerWidth(width - padding);
        return;
      }
      
      const sidebarWidth = width < 1024 ? 0 : 350;
      const thumbnailWidth = width < 768 ? 0 : 192;
      
      let layoutPadding = 32;
      if (width >= 640 && width < 1024) {
        layoutPadding = 80;
      } else if (width >= 1024) {
        layoutPadding = 120;
      }
      
      const calculated = width - sidebarWidth - thumbnailWidth - layoutPadding;
      setContainerWidth(calculated > 0 ? calculated : 600);
    };
    
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isPublic, pdfUrl]);

  useEffect(() => {
    if (pdfBuffer) {
      setLoading(true);
      // pdfBuffer is now fundamentally a Blob natively returned from axios because responseType: 'blob'.
      // If it's still somehow an array buffer fallback to mapping it, otherwise just use it directly.
      const blobObj = pdfBuffer instanceof Blob ? pdfBuffer : new Blob([pdfBuffer], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blobObj);
      setPdfUrl(url);
      return () => window.URL.revokeObjectURL(url);
    }
  }, [pdfBuffer]);

  // When successfully loaded
  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setLoading(false);
    if (onLoadSuccess) onLoadSuccess();
  }

  // Handle Zoom
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.6));

  // Handle Pagination
  const prevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const nextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));

  // Handle Download
  const handleDownload = () => {
    try {
      if (!pdfBuffer) return;
      const url = window.URL.createObjectURL(new Blob([pdfBuffer], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'Lab_Report.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started!");
      if (onDeliver) onDeliver();
    } catch (e) {
      toast.error("Download failed.");
    }
  };

  // Handle Print via hidden iframe
  const handlePrint = () => {
    try {
      if (!pdfBuffer) return;
      const url = window.URL.createObjectURL(new Blob([pdfBuffer], { type: 'application/pdf' }));
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        if (onDeliver) onDeliver();
      };
    } catch (e) {
      toast.error("Print failed. Try downloading first.");
    }
  };

  return (
    <div className={`flex flex-col h-full bg-gray-100 ${isPublic ? '' : 'rounded-2xl border border-gray-200'} overflow-hidden`}>
      {/* Viewer Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={zoomOut} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Zoom Out"><ZoomOut className="w-5 h-5" /></button>
          <span className="text-sm font-bold text-gray-700 tabular-nums w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Zoom In"><ZoomIn className="w-5 h-5" /></button>
        </div>

        {/* Page Indicator */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase tabular-nums">
            Total <span className="text-emerald-600">{numPages}</span> Pages
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {onEmail && (
            <button 
              onClick={isRestricted ? () => { toast.warn("Please settle the payment to enable email."); onRestrict?.(); } : onEmail} 
              disabled={isEmailing}
              className={`flex items-center gap-2 px-3 py-2 ${isRestricted ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70' : 'bg-slate-800 text-white hover:bg-slate-900 active:scale-95'} rounded-lg transition-all shadow-sm disabled:opacity-50`}
            >
              {isEmailing ? <Loader2 className="w-4 h-4 animate-spin" /> : isRestricted ? <Lock className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
              <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">
                {isEmailing ? 'Sending...' : 'Email'}
              </span>
            </button>
          )}
          <button 
            onClick={isRestricted ? () => { toast.warn("Please settle the payment to enable printing."); onRestrict?.(); } : handlePrint} 
            className={`flex items-center gap-2 px-3 py-2 ${isRestricted ? 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-70' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95'} rounded-lg transition-all border border-slate-200`}
          >
            {isRestricted ? <Lock className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
            <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">Print</span>
          </button>
          <button 
            onClick={isRestricted ? () => { toast.warn("Please settle the payment to enable download."); onRestrict?.(); } : handleDownload} 
            className={`flex items-center gap-2 px-3 py-2 ${isRestricted ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-70' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-lg shadow-emerald-600/20'} rounded-lg transition-all`}
          >
            {isRestricted ? <Lock className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">Download</span>
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors ml-1 border border-transparent hover:border-rose-100">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* PDF Rendering Area with Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {loading && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/80 backdrop-blur-sm z-30">
             <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
             <p className="text-sm font-bold text-gray-600 uppercase tracking-widest">Generating Preview...</p>
           </div>
        )}

        {pdfUrl ? (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(err) => {
              setLoading(false);
              if (onLoadError) onLoadError(err);
            }}
            loading={null}
            error={
               <div className="flex-1 flex items-center justify-center">
                 <div className="text-center p-10 bg-white rounded-xl shadow text-rose-600 font-bold">
                   Failed to load PDF document.
                 </div>
               </div>
            }
          >
            <div className="flex h-full w-full overflow-hidden">
              {!isPublic && (
                <div className="w-48 bg-white border-r border-gray-200 overflow-y-auto hidden md:flex flex-col p-3 gap-4 no-scrollbar shadow-[inset_-10px_0_20px_-15px_rgba(0,0,0,0.1)]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pages</h3>
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{numPages || 0} Total</span>
                  </div>
                  
                  {Array.from(new Array(numPages), (el, index) => (
                    <div 
                      key={index} 
                      onClick={() => {
                        setPageNumber(index + 1);
                        document.getElementById(`page-${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={`group relative cursor-pointer transition-all duration-300 rounded-xl overflow-hidden border-2 ${pageNumber === index + 1 ? 'border-emerald-500 ring-4 ring-emerald-100 shadow-xl scale-[1.02]' : 'border-transparent hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      <div className="bg-white flex justify-center p-3">
                        <Page 
                          pageNumber={index + 1} 
                          scale={0.2} 
                          renderTextLayer={false} 
                          renderAnnotationLayer={false} 
                          className="thumbnail-page pointer-events-none"
                        />
                      </div>
                      <div className={`text-[9px] font-black text-center py-2 transition-colors tracking-widest uppercase ${pageNumber === index + 1 ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-400 group-hover:text-gray-600'}`}>
                        Page {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Main Viewer */}
              <div className={`flex-1 overflow-auto bg-gray-200/50 ${isPublic ? 'p-0' : 'p-6 sm:p-12'} flex flex-col items-center gap-4 relative scroll-smooth`}>
                {Array.from(new Array(numPages), (el, index) => (
                  <div key={index} id={`page-${index + 1}`} className={`shadow-2xl shadow-gray-400/30 ${isPublic ? 'border-b' : 'border rounded-xl'} border-gray-300 bg-white transition-all duration-300`}>
                    <Page 
                      pageNumber={index + 1} 
                      width={containerWidth ? Math.min(containerWidth, 800) * scale : undefined} 
                      loading={<div className="h-96 w-64 flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          </Document>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 bg-slate-50/50 backdrop-blur-sm z-30">
             <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
             <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] animate-pulse">Generating PDF Report...</p>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">This will take only a moment</p>
          </div>
        )}
      </div>
    </div>

  );
}
