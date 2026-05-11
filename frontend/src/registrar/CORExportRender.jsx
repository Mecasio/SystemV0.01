import React from "react";
import { useSearchParams } from "react-router-dom";
import CertificateOfRegistration from "../components/CertificateOfRegistration";
import API_BASE_URL from "../apiConfig";

const CORExportRender = () => {
  const [searchParams] = useSearchParams();
  const studentNumber = searchParams.get("student_number") || "";
  const personId = searchParams.get("person_id") || "";
  const jobId = searchParams.get("job_id") || "";
  const [preload, setPreload] = React.useState(null);
  const [isPreloadReady, setIsPreloadReady] = React.useState(!jobId);
  const pageRef = React.useRef(null);
  const contentRef = React.useRef(null);

  const fitToA4 = React.useCallback(() => {
    window.__COR_READY = false;
    window.__COR_FIT_COMPLETE = false;

    const nextFrame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    const waitForImages = (content) =>
      Promise.all(
        Array.from(content.querySelectorAll("img")).map((image) => {
          if (image.complete) return Promise.resolve();
          return new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          });
        }),
      );

    const applyFit = async () => {
      const page = pageRef.current;
      const content = contentRef.current;
      if (!page || !content) {
        window.__COR_READY = true;
        window.__COR_FIT_COMPLETE = true;
        return;
      }

      content.style.transform = "none";
      content.style.width = "210mm";

      await nextFrame();
      await waitForImages(content);
      await nextFrame();

      const pageRect = page.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const descendantRects = Array.from(content.querySelectorAll("*")).map(
        (child) => child.getBoundingClientRect(),
      );
      const maxRight = Math.max(
        contentRect.right,
        ...descendantRects.map((rect) => rect.right),
      );
      const maxBottom = Math.max(
        contentRect.bottom,
        ...descendantRects.map((rect) => rect.bottom),
      );
      const naturalWidth = Math.max(
        content.scrollWidth,
        content.offsetWidth,
        maxRight - contentRect.left,
        1,
      );
      const naturalHeight = Math.max(
        content.scrollHeight,
        content.offsetHeight,
        maxBottom - contentRect.top,
        1,
      );
      let scale = Math.min(
        0.94,
        (pageRect.width - 2) / naturalWidth,
        (pageRect.height - 2) / naturalHeight,
      );

      content.style.transform = `scale(${scale})`;
      content.style.transformOrigin = "top left";
      content.style.width = `${naturalWidth}px`;
      content.style.height = `${naturalHeight}px`;
      await nextFrame();

      const fittedRect = content.getBoundingClientRect();
      const pageRectAfterFit = page.getBoundingClientRect();
      const overflowAdjustment = Math.min(
        1,
        (pageRectAfterFit.width - 4) / Math.max(fittedRect.width, 1),
        (pageRectAfterFit.height - 4) / Math.max(fittedRect.height, 1),
      );

      if (overflowAdjustment < 1) {
        scale *= overflowAdjustment;
        content.style.transform = `scale(${scale})`;
        await nextFrame();
      }

      window.__COR_SCALE = scale;
      window.__COR_FITS_A4 = true;
      window.__COR_READY = true;
      window.__COR_FIT_COMPLETE = true;
    };

    applyFit();
  }, []);

  const handleReady = () => {
    fitToA4();
  };

  React.useEffect(() => {
    window.__COR_READY = false;
    window.__COR_SCALE = 1;
    window.__COR_FITS_A4 = false;
    window.__COR_FIT_COMPLETE = false;
    setPreload(null);

    if (!jobId || !studentNumber) {
      setIsPreloadReady(true);
      return;
    }

    let isMounted = true;
    setIsPreloadReady(false);

    fetch(
      `${API_BASE_URL}/api/cor-export/jobs/${jobId}/preload/${encodeURIComponent(
        studentNumber,
      )}`,
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (isMounted) setPreload(data?.preload || null);
      })
      .catch(() => {
        if (isMounted) setPreload(null);
      })
      .finally(() => {
        if (isMounted) setIsPreloadReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, [jobId, studentNumber]);

  return (
    <div
      id="server-cor-export"
      ref={pageRef}
      style={{
        width: "210mm",
        height: "297mm",
        minHeight: "297mm",
        overflow: "hidden",
        background: "#ffffff",
        position: "relative",
        margin: 0,
        padding: 0,
      }}
    >
      <style>
        {`
          @page { size: A4; margin: 0; }
          html, body, #root {
            width: 210mm;
            height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #fff !important;
          }
          #server-cor-export * {
            box-sizing: border-box;
          }
        `}
      </style>
      <div
        ref={contentRef}
        style={{
          width: "210mm",
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {isPreloadReady && (
          <CertificateOfRegistration
            student_number={studentNumber}
            person_id={personId}
            preload={preload}
            containerId="server-cor-export"
            onReady={handleReady}
          />
        )}
      </div>
    </div>
  );
};

export default CORExportRender;
