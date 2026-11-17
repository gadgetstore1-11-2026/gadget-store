"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type ProductShareProps = {
  productId: string;
  productName: string;
  className?: string;
};

export default function ProductShare({
  productId,
  productName,
  className = "",
}: ProductShareProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function productUrl() {
    if (typeof window === "undefined") return "";

    return `${window.location.origin}/product/${encodeURIComponent(productId)}`;
  }

  function updatePosition() {
    const trigger = triggerRef.current;
    const panel = panelRef.current;

    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    const margin = 16;
    const panelWidth = Math.min(310, window.innerWidth - margin * 2);

    const left = Math.max(
      margin,
      Math.min(
        rect.right - panelWidth,
        window.innerWidth - panelWidth - margin
      )
    );

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;

    if (spaceBelow >= panelRect.height + 16) {
      top = rect.bottom + 10;
    } else if (spaceAbove >= panelRect.height + 16) {
      top = rect.top - panelRect.height - 10;
    } else {
      top = Math.max(
        margin,
        Math.min(
          rect.bottom + 10,
          window.innerHeight - panelRect.height - margin
        )
      );
    }

    setPosition({ top, left });
  }

  useLayoutEffect(() => {
    if (!open || !mounted) return;

    updatePosition();

    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: PointerEvent) {
      const target = event.target as Node;

      if (
        containerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function copyLink() {
    const url = productUrl();

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2200);
    } catch {
      window.prompt("Copy this product link:", url);
    }
  }

  function shareTo(platform: "whatsapp" | "facebook" | "messenger") {
    const url = encodeURIComponent(productUrl());

    const text = encodeURIComponent(
      `Check out ${productName} at Gadget Store`
    );

    const links = {
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      messenger: `https://www.facebook.com/dialog/send?link=${url}&app_id=966242223397117&redirect_uri=${url}`,
    };

    window.open(
      links[platform],
      "_blank",
      "noopener,noreferrer,width=680,height=600"
    );

    setOpen(false);
  }

  async function nativeShare() {
    const url = productUrl();

    if (navigator.share) {
      try {
        await navigator.share({
          title: productName,
          text: `Check out ${productName} at Gadget Store`,
          url,
        });

        setOpen(false);
      } catch {
        // The user may dismiss the native share sheet.
      }
    } else {
      await copyLink();
    }
  }

  return (
    <div
      ref={containerRef}
      className={`gs-product-share ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="gs-share-trigger"
        aria-label={`Share ${productName}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.7 10.6 6.6-4.2M8.7 13.4l6.6 4.2" />
        </svg>

        <span>Share</span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            className="gs-share-panel"
            role="dialog"
            aria-label="Share product"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              right: "auto",
              zIndex: 99999,
              width: "min(310px, calc(100vw - 32px))",
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto",
            }}
          >
            <div className="gs-share-panel-heading">
              <div>
                <strong>Share this product</strong>
                <small>
                  Let someone discover something they’ll love.
                </small>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="gs-share-options">
              <button
                type="button"
                onClick={() => shareTo("whatsapp")}
              >
                <span className="gs-share-brand gs-share-whatsapp">W</span>
                WhatsApp
              </button>

              <button
                type="button"
                onClick={() => shareTo("facebook")}
              >
                <span className="gs-share-brand gs-share-facebook">f</span>
                Facebook
              </button>

              <button
                type="button"
                onClick={() => shareTo("messenger")}
              >
                <span className="gs-share-brand gs-share-messenger">⌁</span>
                Messenger
              </button>

              <button
                type="button"
                onClick={nativeShare}
              >
                <span className="gs-share-brand gs-share-native">↗</span>
                More
              </button>
            </div>

            <button
              type="button"
              className="gs-share-copy"
              onClick={copyLink}
            >
              <span>
                {copied
                  ? "✓ Link copied successfully!"
                  : "Copy product link"}
              </span>

              <b>{copied ? "Copied" : "Copy link"}</b>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
