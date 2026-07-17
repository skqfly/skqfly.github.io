import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import "./TalksGallery.css";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const getDateParts = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return {
    year,
    month: MONTHS[month - 1],
    day: String(day).padStart(2, "0"),
    full: `${year}年${month}月${day}日`,
    compact: `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`,
  };
};

function TalkPreview({ images, eager = false }) {
  if (images.length === 0) return null;

  const visibleImages = images.slice(0, 4);
  const extraImages = Math.max(0, images.length - visibleImages.length);
  const layoutCount = Math.min(images.length, 4);

  return (
    <span
      className="talk-preview"
      data-count={layoutCount}
      aria-hidden="true"
    >
      {visibleImages.map((image, index) => {
        const showExtra = extraImages > 0 && index === visibleImages.length - 1;

        return (
          <span
            className="talk-preview__item"
            data-image-index={index}
            key={image.src}
          >
            <img
              src={image.src}
              width={image.width}
              height={image.height}
              alt=""
              loading={eager && index === 0 ? "eager" : "lazy"}
              fetchPriority={eager && index === 0 ? "high" : "auto"}
              decoding="async"
              draggable={false}
            />
            {showExtra && (
              <span className="talk-preview__extra">+{extraImages}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TalkTimelineItem({ talk, index, onOpen, selected }) {
  const date = getDateParts(talk.date);
  const imageCount = talk.images.length;
  const content = `${talk.title}。${talk.description}`;

  return (
    <li className="talk-timeline__item">
      <time
        className="talk-timeline__date"
        dateTime={talk.date}
        aria-label={date.full}
      >
        <span className="talk-timeline__day">{date.day}</span>
        <span className="talk-timeline__month">{date.month}</span>
      </time>

      <span className="talk-timeline__rail" aria-hidden="true">
        <span className="talk-timeline__dot" />
      </span>

      <button
        className={
          imageCount > 0 ? "talk-card" : "talk-card talk-card--static"
        }
        type="button"
        data-image-count={imageCount}
        aria-haspopup={imageCount > 0 ? "dialog" : undefined}
        aria-controls={imageCount > 0 ? "talk-detail-dialog" : undefined}
        aria-expanded={imageCount > 0 ? selected : undefined}
        aria-label={
          imageCount > 0 ? `查看图片：${content}` : content
        }
        disabled={imageCount === 0}
        onClick={(event) => {
          const previewItem = event.target.closest("[data-image-index]");
          const imageIndex = Number(previewItem?.dataset.imageIndex ?? 0);
          onOpen(talk, event.currentTarget, imageIndex);
        }}
      >
        <span className="talk-card__body">
          <span className="talk-card__content">{content}</span>

          <TalkPreview
            images={talk.images}
            eager={index <= 3}
          />

          <time className="talk-card__date" dateTime={talk.date}>
            {date.compact}
          </time>
        </span>
      </button>
    </li>
  );
}

export default function TalksGallery({ entries }) {
  const galleryRef = useRef(null);
  const dialogRef = useRef(null);
  const lastTriggerRef = useRef(null);
  const [selectedTalk, setSelectedTalk] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  );

  useEffect(() => {
    const gallery = galleryRef.current;
    if (
      !gallery ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const items = Array.from(
      gallery.querySelectorAll(
        ".talk-timeline__item, .talk-timeline__year",
      ),
    );
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("motion-reveal--visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.06,
      },
    );

    items.forEach((item, index) => {
      const bounds = item.getBoundingClientRect();
      const isInitiallyVisible =
        bounds.top < window.innerHeight * 0.92 && bounds.bottom > 0;

      if (isInitiallyVisible) return;

      item.classList.add("motion-reveal");
      item.style.setProperty(
        "--motion-reveal-delay",
        `${(index % 4) * 35}ms`,
      );
      revealObserver.observe(item);
    });

    return () => revealObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedTalk || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => {
      dialog.querySelector(".talk-lightbox__close")?.focus();
    });

    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [selectedTalk]);

  useEffect(() => {
    if (!selectedTalk || selectedTalk.images.length < 2) return;

    const handleKeyDown = (event) => {
      if (event.key === "ArrowRight") {
        setSelectedImageIndex(
          (index) => (index + 1) % selectedTalk.images.length,
        );
      }

      if (event.key === "ArrowLeft") {
        setSelectedImageIndex(
          (index) =>
            (index - 1 + selectedTalk.images.length) %
            selectedTalk.images.length,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTalk]);

  const openTalk = (talk, trigger, imageIndex = 0) => {
    if (talk.images.length === 0) return;

    lastTriggerRef.current = trigger;
    setSelectedImageIndex(imageIndex);
    setSelectedTalk(talk);
  };

  const closeDialog = () => {
    dialogRef.current?.close();
  };

  const handleDialogClose = () => {
    setSelectedTalk(null);
    setSelectedImageIndex(0);
    requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) closeDialog();
  };

  const selectedImage = selectedTalk?.images[selectedImageIndex] ?? null;

  const showNextImage = () => {
    if (!selectedTalk || selectedTalk.images.length < 2) return;
    setSelectedImageIndex(
      (index) => (index + 1) % selectedTalk.images.length,
    );
  };

  return (
    <div className="talks-gallery" ref={galleryRef}>
      <div className="talks-layout">
        <ol className="talk-timeline" aria-label="Talks 时间线">
          {sortedEntries.map((talk, index) => {
            const year = getDateParts(talk.date).year;
            const previousYear =
              index > 0
                ? getDateParts(sortedEntries[index - 1].date).year
                : year;
            const startsNewYear = index > 0 && year !== previousYear;

            return (
              <Fragment key={talk.id}>
                {startsNewYear && (
                  <li
                    className="talk-timeline__year"
                    role="separator"
                    aria-label={`${year} 年`}
                  >
                    <span className="talk-timeline__year-label">{year}</span>
                    <span
                      className="talk-timeline__year-rail"
                      aria-hidden="true"
                    />
                  </li>
                )}

                <TalkTimelineItem
                  talk={talk}
                  index={index}
                  onOpen={openTalk}
                  selected={selectedTalk?.id === talk.id}
                />
              </Fragment>
            );
          })}
        </ol>
      </div>

      <p className="talks-end-note">
        <span aria-hidden="true" />
        继续记录，慢慢整理。
        <span aria-hidden="true" />
      </p>

      <dialog
        ref={dialogRef}
        id="talk-detail-dialog"
        className="talks-dialog"
        aria-label="图片大图预览"
        onClick={handleBackdropClick}
        onClose={handleDialogClose}
      >
        {selectedTalk && selectedImage && (
          <>
            <button
              className="talk-lightbox__close"
              type="button"
              aria-label="关闭图片预览"
              title="关闭"
              onClick={closeDialog}
            >
              <CloseIcon />
            </button>

            <button
              className="talk-lightbox__image-button"
              type="button"
              disabled={selectedTalk.images.length < 2}
              aria-label={
                selectedTalk.images.length > 1
                  ? "查看下一张图片"
                  : selectedImage.alt
              }
              onClick={showNextImage}
            >
              <img
                className="talk-lightbox__image"
                src={selectedImage.src}
                width={selectedImage.width}
                height={selectedImage.height}
                alt={selectedImage.alt}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                draggable={false}
              />
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}
