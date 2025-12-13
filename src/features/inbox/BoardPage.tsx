import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import ActivityCard from "../day/ActivityCard";
import { AnimatePresence, motion } from "framer-motion";
import { FAST_TRANSITION } from "../../shared/theme/animations";
import {
  useActivitiesStore,
  getInboxActivities,
  getLaterActivities,
} from "../../shared/store/activitiesStore";
import type { Activity, Bucket } from "../../shared/types/activity";
import AddActivityModal from "../../shared/components/AddActivityModal";
import { TouchDragOverlay, type TouchDragOverlayHandle } from "../../shared/components/TouchDragOverlay";
import { useAutoScroll } from "../../shared/hooks/useAutoScroll";
import { useThrottledCallback } from "../../shared/hooks/useThrottle";
import WeekActivityRow from "../week/WeekActivityRow";
import { DesktopDivider as Divider, DesktopEmptySlot as EmptySlot } from "../week/DesktopColumnPrimitives";
import { useDesktopLayout } from "../../shared/hooks/useDesktopLayout";
import {
  computeAnchoredPreviewOrder,
  computePlaceholderPreview,
  DRAG_PLACEHOLDER_ID,
} from "../../shared/utils/activityOrdering";

const BoardPage = () => {
  const activities = useActivitiesStore((state) => state.activities);
  const toggleDone = useActivitiesStore((state) => state.toggleDone);
  const deleteActivity = useActivitiesStore((state) => state.deleteActivity);
  const updateActivity = useActivitiesStore((state) => state.updateActivity);
  const reorderInBucket = useActivitiesStore((state) => state.reorderInBucket);
  const moveToInbox = useActivitiesStore((state) => state.moveToInbox);
  const moveToLater = useActivitiesStore((state) => state.moveToLater);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activityBeingEdited, setActivityBeingEdited] = useState<Activity | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newActivityPlacement, setNewActivityPlacement] = useState<Extract<Bucket, "inbox" | "later">>("inbox");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggedCardHeight, setDraggedCardHeight] = useState<number>(72);
  const [previewInbox, setPreviewInbox] = useState<Activity[] | null>(null);
  const [previewLater, setPreviewLater] = useState<Activity[] | null>(null);
  const inboxContainerRef = useRef<HTMLDivElement>(null);
  const laterContainerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | Window | null>(null);
  const preventDefaultTouchMoveRef = useRef<((e: TouchEvent) => void) | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const isTouchDraggingRef = useRef(false);
  const touchDragBucketRef = useRef<Extract<Bucket, "inbox" | "later"> | null>(null);

  // Callback to refresh cached container rects during autoscroll
  const refreshCachedRects = useCallback(() => {
    if (inboxContainerRef.current) {
      inboxRectRef.current = inboxContainerRef.current.getBoundingClientRect();
    }
    if (laterContainerRef.current) {
      laterRectRef.current = laterContainerRef.current.getBoundingClientRect();
    }
  }, []);

  const { startAutoScroll, stopAutoScroll } = useAutoScroll({
    scrollContainer: scrollContainer ?? window,
    onScrolling: refreshCachedRects,
  });

  const { isDesktop } = useDesktopLayout();
  const [isTouchDrag, setIsTouchDrag] = useState(false);
  const [touchDragOverBucket, setTouchDragOverBucket] = useState<Extract<Bucket, "inbox" | "later"> | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialDragPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const overlayRef = useRef<TouchDragOverlayHandle>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const dragLeaveTimeoutRef = useRef<number | null>(null);
  // Cached container rects to avoid layout thrashing during drag
  const inboxRectRef = useRef<DOMRect | null>(null);
  const laterRectRef = useRef<DOMRect | null>(null);
  const lastBucketUpdateRef = useRef<number>(0);
  const throttledSetPreviewInbox = useThrottledCallback(
    (order: Activity[] | null) => setPreviewInbox(order),
    32
  );
  const throttledSetPreviewLater = useThrottledCallback(
    (order: Activity[] | null) => setPreviewLater(order),
    32
  );

  // Cleanup effect to ensure styles are always reset on unmount
  useEffect(() => {
    return () => {
      if (preventDefaultTouchMoveRef.current) {
        document.removeEventListener("touchmove", preventDefaultTouchMoveRef.current);
        preventDefaultTouchMoveRef.current = null;
      }
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.body.style.overscrollBehavior = "";
    };
  }, []);

  useEffect(() => {
    if (isTouchDrag && !preventDefaultTouchMoveRef.current) {
      const preventDefault = (e: TouchEvent) => {
        e.preventDefault();
      };
      preventDefaultTouchMoveRef.current = preventDefault;
      document.addEventListener("touchmove", preventDefault, { passive: false });
      return () => {
        if (preventDefaultTouchMoveRef.current) {
          document.removeEventListener("touchmove", preventDefaultTouchMoveRef.current);
          preventDefaultTouchMoveRef.current = null;
        }
      };
    }
  }, [isTouchDrag]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const main = document.querySelector("main") as HTMLElement | null;
    if (main) {
      setScrollContainer(main);
    } else {
      setScrollContainer(window);
    }
  }, []);

  const inboxActivities = useMemo(
    () => getInboxActivities(activities),
    [activities]
  );
  const laterActivities = useMemo(
    () => getLaterActivities(activities),
    [activities]
  );

  const displayInbox = isDesktop && !isTouchDrag
    ? inboxActivities
    : (previewInbox ?? inboxActivities);
  const displayLater = isDesktop && !isTouchDrag
    ? laterActivities
    : (previewLater ?? laterActivities);
  const canShowDesktopAddSlot = isDesktop && !draggingId;

  const handleToggleDone = (id: string) => {
    toggleDone(id);
  };

  const handleEdit = (activity: Activity) => {
    setActivityBeingEdited(activity);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setActivityBeingEdited(null);
  };

  const handleDeleteActivity = (id: string) => {
    deleteActivity(id);
    handleCloseEditModal();
  };

  const handleOpenCreateModal = (placement: Extract<Bucket, "inbox" | "later">) => {
    setNewActivityPlacement(placement);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const getBucketOrderedIds = (
    bucket: Extract<Bucket, "inbox" | "later">,
    excludeId?: string
  ): string[] => {
    const items = bucket === "inbox" ? inboxActivities : laterActivities;
    return items.filter((activity) => activity.id !== excludeId).map((activity) => activity.id);
  };

  const resetDragState = useCallback(() => {
    setDraggingId(null);
    setPreviewInbox(null);
    setPreviewLater(null);
    setDragOverKey(null);
    throttledSetPreviewInbox.cancel();
    throttledSetPreviewLater.cancel();
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    stopAutoScroll();
  }, [throttledSetPreviewInbox, throttledSetPreviewLater, stopAutoScroll]);

  useEffect(() => {
    if (!isDesktop || isTouchDrag || !draggingId) return;
    const reset = () => resetDragState();
    const resetIfDroppedOutside = (event: DragEvent) => {
      const target = event.target as Node | null;
      if (target) {
        const inboxContains = inboxContainerRef.current?.contains(target) ?? false;
        const laterContains = laterContainerRef.current?.contains(target) ?? false;
        if (inboxContains || laterContains) {
          return;
        }
      }
      resetDragState();
    };
    window.addEventListener("dragend", reset, true);
    window.addEventListener("drop", resetIfDroppedOutside, true);
    return () => {
      window.removeEventListener("dragend", reset, true);
      window.removeEventListener("drop", resetIfDroppedOutside, true);
    };
  }, [isDesktop, isTouchDrag, draggingId, resetDragState]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, activity: Activity) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", activity.id);
    setDraggingId(activity.id);
    setPreviewInbox(null);
    setPreviewLater(null);
    setDragOverKey(null);

    // Capture the height of the card being dragged
    const target = event.currentTarget;
    if (target) {
      setDraggedCardHeight(target.offsetHeight);
    }
  };

  const handleDragEnd = () => {
    resetDragState();
  };

  const makeBucketZoneKey = (bucket: Extract<Bucket, "inbox" | "later">, index: number) =>
    `bucket-${bucket}-zone-${index}`;
  const makeBucketAppendKey = (bucket: Extract<Bucket, "inbox" | "later">) =>
    `bucket-${bucket}-append`;

  const handleDragOverZone = (
    event: React.DragEvent<HTMLElement>,
    key: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    if (dragOverKey !== key) {
      setDragOverKey(key);
    }
    startAutoScroll(event.clientY);
  };

  const handleDragLeaveZone = (
    event: React.DragEvent<HTMLElement> | null,
    key: string
  ) => {
    if (event) {
      const nextTarget = event.relatedTarget as Node | null;
      if (nextTarget && event.currentTarget.contains(nextTarget)) {
        return;
      }
    }
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
    }
    dragLeaveTimeoutRef.current = window.setTimeout(() => {
      if (dragOverKey === key) {
        setDragOverKey(null);
      }
      dragLeaveTimeoutRef.current = null;
    }, 50);
  };

  const handleDropOnBucket = (
    event: React.DragEvent<HTMLElement>,
    bucket: Extract<Bucket, "inbox" | "later">,
    targetIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const droppedId = draggingId ?? event.dataTransfer.getData("text/plain");
    const activity = droppedId ? activities.find((a) => a.id === droppedId) : null;

    if (!activity) {
      resetDragState();
      return;
    }

    if (activity.bucket !== bucket) {
      if (bucket === "inbox") {
        moveToInbox(activity.id);
      } else {
        moveToLater(activity.id);
      }
    }

    const orderedIds = getBucketOrderedIds(bucket, activity.id);
    const clampedIndex = Math.min(Math.max(targetIndex, 0), orderedIds.length);
    orderedIds.splice(clampedIndex, 0, activity.id);
    reorderInBucket(bucket, orderedIds);

    resetDragState();
  };

  // Touch drag handlers for mobile
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const getTargetIndexFromY = useCallback((
    clientY: number,
    bucket: Extract<Bucket, "inbox" | "later">
  ): number => {
    const containerRef = bucket === "inbox" ? inboxContainerRef : laterContainerRef;
    if (!containerRef.current) return 0;
    const cards = containerRef.current.querySelectorAll("[data-activity-id]");
    let targetIndex = 0;

    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY > midY) {
        targetIndex = index + 1;
      }
    });

    return targetIndex;
  }, []);

  const getBucketAtPosition = useCallback((clientX: number, clientY: number): Extract<Bucket, "inbox" | "later"> | null => {
    // Use cached rects to avoid layout thrashing
    const inboxRect = inboxRectRef.current;
    if (inboxRect) {
      if (
        clientX >= inboxRect.left &&
        clientX <= inboxRect.right &&
        clientY >= inboxRect.top &&
        clientY <= inboxRect.bottom
      ) {
        return "inbox";
      }
    }

    const laterRect = laterRectRef.current;
    if (laterRect) {
      if (
        clientX >= laterRect.left &&
        clientX <= laterRect.right &&
        clientY >= laterRect.top &&
        clientY <= laterRect.bottom
      ) {
        return "later";
      }
    }

    return null;
  }, []);

  const handleTouchStart = useCallback((
    event: React.TouchEvent<HTMLDivElement>,
    activity: Activity,
    bucket: Extract<Bucket, "inbox" | "later">
  ) => {
    const touch = event.touches[0];
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;

    touchStartYRef.current = touch.clientY;
    touchStartXRef.current = touch.clientX;
    isTouchDraggingRef.current = false;
    touchDragBucketRef.current = bucket;

    clearLongPressTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      isTouchDraggingRef.current = true;
      setDraggingId(activity.id);
      setIsTouchDrag(true);
      // Store offset in ref for imperative updates (no re-render)
      dragOffsetRef.current = { x: offsetX, y: offsetY };
      initialDragPosRef.current = { x: touch.clientX - offsetX, y: touch.clientY - offsetY };
      setPreviewInbox(null);
      setPreviewLater(null);
      const preventDefault = (e: TouchEvent) => e.preventDefault();
      preventDefaultTouchMoveRef.current = preventDefault;
      document.addEventListener("touchmove", preventDefault, { passive: false });
      // Cache container rects at drag start to avoid layout thrashing
      if (inboxContainerRef.current) {
        inboxRectRef.current = inboxContainerRef.current.getBoundingClientRect();
      }
      if (laterContainerRef.current) {
        laterRectRef.current = laterContainerRef.current.getBoundingClientRect();
      }
      // Prevent pull-to-refresh on Android
      document.body.style.overscrollBehavior = "none";
      const containerRef = bucket === "inbox" ? inboxContainerRef : laterContainerRef;
      if (scrollContainer && scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = "hidden";
        scrollContainer.style.touchAction = "none";
        scrollContainer.style.overscrollBehavior = "none";
      } else if (containerRef.current) {
        containerRef.current.style.overflow = "hidden";
        containerRef.current.style.touchAction = "none";
        containerRef.current.style.overscrollBehavior = "none";
      } else {
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
      }
    }, 150);
  }, [clearLongPressTimer, scrollContainer, inboxContainerRef, laterContainerRef]);

  const handleTouchMove = useCallback((
    event: React.TouchEvent<HTMLDivElement>,
    activityId: string,
    originalBucket: Extract<Bucket, "inbox" | "later">
  ) => {
    const touch = event.touches[0];

    if (!isTouchDraggingRef.current) {
      const deltaX = Math.abs(touch.clientX - touchStartXRef.current);
      const deltaY = Math.abs(touch.clientY - touchStartYRef.current);

      if (deltaX > 10 || deltaY > 10) {
        clearLongPressTimer();
      }
      return;
    }

    event.preventDefault();

    // Update overlay position imperatively (no React re-render) for smooth 60fps
    overlayRef.current?.updatePosition(
      touch.clientX - dragOffsetRef.current.x,
      touch.clientY - dragOffsetRef.current.y
    );

    const detectedBucket =
      getBucketAtPosition(touch.clientX, touch.clientY) ??
      touchDragBucketRef.current ??
      originalBucket;

    if (detectedBucket !== touchDragBucketRef.current) {
      touchDragBucketRef.current = detectedBucket;
    }

    const now = Date.now();
    if (now - lastBucketUpdateRef.current > 50) {
      lastBucketUpdateRef.current = now;
      setTouchDragOverBucket(detectedBucket);
    }

    const targetBucket = touchDragBucketRef.current ?? originalBucket;
    const targetIndex = getTargetIndexFromY(touch.clientY, targetBucket);
    const draggedActivity = activities.find((a) => a.id === activityId);
    if (!draggedActivity) return;

    if (draggedActivity.bucket === targetBucket) {
      const sourceList = targetBucket === "inbox" ? inboxActivities : laterActivities;
      const newOrder = computeAnchoredPreviewOrder(sourceList, activityId, targetIndex);
      if (targetBucket === "inbox") {
        throttledSetPreviewInbox(newOrder);
        setPreviewLater(null);
      } else {
        throttledSetPreviewLater(newOrder);
        setPreviewInbox(null);
      }
    } else {
      const targetList = targetBucket === "inbox" ? inboxActivities : laterActivities;
      const newOrder = computePlaceholderPreview(targetList, draggedActivity, targetIndex);
      if (targetBucket === "inbox") {
        throttledSetPreviewInbox(newOrder);
        setPreviewLater(null);
      } else {
        throttledSetPreviewLater(newOrder);
        setPreviewInbox(null);
      }
    }

    // Auto-scroll when near edges
    startAutoScroll(touch.clientY);
  }, [clearLongPressTimer, getBucketAtPosition, startAutoScroll, getTargetIndexFromY, activities, inboxActivities, laterActivities, throttledSetPreviewInbox, throttledSetPreviewLater]);

  const handleTouchEnd = useCallback((
    activityId: string,
    originalBucket: Extract<Bucket, "inbox" | "later">
  ) => {
    clearLongPressTimer();

    if (isTouchDraggingRef.current) {
      const draggedActivity = activities.find((a) => a.id === activityId);
      const targetBucket = touchDragBucketRef.current || originalBucket;
      const preview = targetBucket === "inbox" ? previewInbox : previewLater;

      if (draggedActivity && preview) {
        if (draggedActivity.bucket !== targetBucket) {
          if (targetBucket === "inbox") {
            moveToInbox(activityId);
          } else {
            moveToLater(activityId);
          }
        }

        const finalOrderedIds = preview.map((a) =>
          a.id === DRAG_PLACEHOLDER_ID ? activityId : a.id
        );
        reorderInBucket(targetBucket, finalOrderedIds);
      }
    }

    isTouchDraggingRef.current = false;
    touchDragBucketRef.current = null;
    setIsTouchDrag(false);
    setTouchDragOverBucket(null);
    // Reset all scroll-related styles including overscrollBehavior
    document.body.style.overscrollBehavior = "";
    if (scrollContainer && scrollContainer instanceof HTMLElement) {
      scrollContainer.style.overflow = "";
      scrollContainer.style.touchAction = "";
      scrollContainer.style.overscrollBehavior = "";
    } else {
      if (inboxContainerRef.current) {
        inboxContainerRef.current.style.overflow = "";
        inboxContainerRef.current.style.touchAction = "";
        inboxContainerRef.current.style.overscrollBehavior = "";
      }
      if (laterContainerRef.current) {
        laterContainerRef.current.style.overflow = "";
        laterContainerRef.current.style.touchAction = "";
        laterContainerRef.current.style.overscrollBehavior = "";
      }
      if (!inboxContainerRef.current && !laterContainerRef.current) {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      }
    }
    if (preventDefaultTouchMoveRef.current) {
      document.removeEventListener("touchmove", preventDefaultTouchMoveRef.current);
      preventDefaultTouchMoveRef.current = null;
    }
    stopAutoScroll();
    resetDragState();
  }, [clearLongPressTimer, activities, moveToInbox, moveToLater, reorderInBucket, stopAutoScroll, scrollContainer, previewInbox, previewLater, resetDragState]);

  // top date removed; no formattedDate needed

  return (
    <>
      <div className={`mx-auto w-full max-w-xl px-4 ${isDesktop ? "pt-0" : "pt-4"}`}>
        {isDesktop ? (
          <div className="space-y-8">
            {(["inbox", "later"] as const).map((bucket) => {
              const bucketActivities = bucket === "inbox" ? displayInbox : displayLater;
              const label = bucket === "inbox" ? "Inbox" : "Later";
              const appendKey = makeBucketAppendKey(bucket);
              const placeholderCount = Math.max(5 - bucketActivities.length, 0);
              const totalSlots = Math.max(placeholderCount, 1);
              let zoneIndex = 0;

              return (
                <div
                  key={bucket}
                  ref={bucket === "inbox" ? inboxContainerRef : laterContainerRef}
                  className="flex min-h-64 flex-col gap-2 px-1 py-3 rounded-xl"
                >
                  <div className="flex items-baseline justify-between gap-2 px-1">
                    <div className="flex items-center gap-1.5 text-base font-semibold text-[var(--color-text-primary)]">
                      <span>{label}</span>
                    </div>
                    <div className="text-base text-[var(--color-text-meta)] mr-3">
                      {bucketActivities.length > 0 ? bucketActivities.length : ""}
                    </div>
                  </div>
                  <div
                    onDragOver={(event) => handleDragOverZone(event, appendKey)}
                    onDragLeave={(event) => handleDragLeaveZone(event, appendKey)}
                    onDrop={(event) => handleDropOnBucket(event, bucket, zoneIndex)}
                  >
                    <>
                      {bucketActivities.map((activity) => {
                        const dropIndex = zoneIndex;
                        const zoneKey = makeBucketZoneKey(bucket, zoneIndex);
                        zoneIndex += 1;

                        return (
                          <motion.div
                            layout
                            initial={false}
                            transition={FAST_TRANSITION}
                            key={activity.id}
                          >
                            <Divider
                              isActive={dragOverKey === zoneKey}
                              onDragOver={(event) => handleDragOverZone(event, zoneKey)}
                              onDragLeave={(event) => handleDragLeaveZone(event, zoneKey)}
                              onDrop={(event) => handleDropOnBucket(event, bucket, dropIndex)}
                            />
                            <WeekActivityRow
                              activity={activity}
                              onToggleDone={handleToggleDone}
                              onEdit={handleEdit}
                              draggable
                              isDragging={draggingId === activity.id}
                              disableHover={draggingId !== null}
                              showNote
                              onDragStart={(event) => handleDragStart(event, activity)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(event) => handleDragOverZone(event, zoneKey)}
                              onDragLeave={(event) => handleDragLeaveZone(event, zoneKey)}
                              onDrop={(event) => handleDropOnBucket(event, bucket, dropIndex)}
                            />
                          </motion.div>
                        );
                      })}
                      {Array.from({ length: totalSlots }).map((_, idx) => {
                        const dropIndex = zoneIndex;
                        const zoneKey = makeBucketZoneKey(bucket, zoneIndex);
                        zoneIndex += 1;
                        const isPrimaryDrop = idx === 0;
                        const activeKey = isPrimaryDrop ? appendKey : zoneKey;

                        return (
                          <div key={`${bucket}-placeholder-${idx}`}>
                            {isPrimaryDrop ? (
                              <>
                                <Divider
                                  isActive={dragOverKey === activeKey}
                                  onDragOver={(event) => handleDragOverZone(event, activeKey)}
                                  onDragLeave={(event) => handleDragLeaveZone(event, activeKey)}
                                  onDrop={(event) => handleDropOnBucket(event, bucket, dropIndex)}
                                />
                                <div
                                  onDragOver={(event) => handleDragOverZone(event, activeKey)}
                                  onDragLeave={(event) => handleDragLeaveZone(event, activeKey)}
                                  onDrop={(event) => handleDropOnBucket(event, bucket, dropIndex)}
                                >
                                  {canShowDesktopAddSlot ? (
                                    <EmptySlot
                                      onClick={() => handleOpenCreateModal(bucket)}
                                    />
                                  ) : (
                                    <div className="min-h-[38px]" />
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <Divider />
                                <div className="min-h-[38px]" />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div
              ref={inboxContainerRef}
              className="mb-6"
            >
              <div className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
                Inbox
              </div>
              <div className="h-px w-full rounded-full bg-[var(--color-border-divider)] mb-2" />
              <div className="min-h-20 relative mb-6 group/section">
                {displayInbox.length === 0 && touchDragOverBucket !== "inbox" && (
                  <div className="absolute inset-0 flex items-start justify-center pointer-events-none transition-opacity">
                    <div className="w-full pt-[20px]">
                      <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                      <div className="h-[30px]" />
                      <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                    </div>
                  </div>
                )}
                <AnimatePresence>
                  {displayInbox.map((activity) => (
                    <motion.div
                      layout
                      key={activity.id}
                      data-activity-id={activity.id}
                      initial={false}
                      transition={FAST_TRANSITION}
                    >
                      {activity.id === DRAG_PLACEHOLDER_ID ? (
                        <div style={{ height: `${draggedCardHeight}px` }} />
                      ) : (
                        <ActivityCard
                          activity={activity}
                          onToggleDone={handleToggleDone}
                          onEdit={handleEdit}
                          draggable={isDesktop}
                          isDragging={draggingId === activity.id}
                          disableHover={draggingId !== null}
                          onDragStart={(e) => handleDragStart(e, activity)}
                          onDragEnd={handleDragEnd}
                          onTouchStart={(e) => handleTouchStart(e, activity, "inbox")}
                          onTouchMove={(e) => handleTouchMove(e, activity.id, "inbox")}
                          onTouchEnd={() => handleTouchEnd(activity.id, "inbox")}
                        />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div
              ref={laterContainerRef}
              className="mb-4"
            >
              <div className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
                Later
              </div>
              <div className="h-px w-full rounded-full bg-[var(--color-border-divider)] mb-2" />
              <div className="min-h-20 relative mb-4 group/section">
                {displayLater.length === 0 && touchDragOverBucket !== "later" && (
                  <div className="absolute inset-0 flex items-start justify-center pointer-events-none transition-opacity">
                    <div className="w-full pt-[20px]">
                      <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                      <div className="h-[30px]" />
                      <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                    </div>
                  </div>
                )}
                <AnimatePresence>
                  {displayLater.map((activity) => (
                    <motion.div
                      layout
                      key={activity.id}
                      data-activity-id={activity.id}
                      initial={false}
                      transition={FAST_TRANSITION}
                    >
                      {activity.id === DRAG_PLACEHOLDER_ID ? (
                        <div style={{ height: `${draggedCardHeight}px` }} />
                      ) : (
                        <ActivityCard
                          activity={activity}
                          onToggleDone={handleToggleDone}
                          onEdit={handleEdit}
                          draggable={isDesktop}
                          isDragging={draggingId === activity.id}
                          disableHover={draggingId !== null}
                          onDragStart={(e) => handleDragStart(e, activity)}
                          onDragEnd={handleDragEnd}
                          onTouchStart={(e) => handleTouchStart(e, activity, "later")}
                          onTouchMove={(e) => handleTouchMove(e, activity.id, "later")}
                          onTouchEnd={() => handleTouchEnd(activity.id, "later")}
                        />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddActivityModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        mode="edit"
        activityToEdit={activityBeingEdited ?? undefined}
        onDelete={handleDeleteActivity}
        onUpdate={updateActivity}
      />

      {/* Create Modal */}
      <AddActivityModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        mode="create"
        initialPlacement={newActivityPlacement}
      />

      {/* Touch Drag Overlay - uses imperative position updates for 60fps performance */}
      {isTouchDrag && draggingId && (
        <TouchDragOverlay
          ref={overlayRef}
          initialX={initialDragPosRef.current.x}
          initialY={initialDragPosRef.current.y}
        >
          <div className="w-[calc(100vw-32px)] max-w-xl pointer-events-none">
            {(() => {
              const activity = activities.find((a) => a.id === draggingId);
              if (!activity) return null;
              return (
                <div className="shadow-xl rounded-md bg-[var(--color-surface)]">
                  <ActivityCard
                    activity={activity}
                    onToggleDone={() => { }}
                    onEdit={() => { }}
                    disableHover
                    forceHover
                  />
                </div>
              );
            })()}
          </div>
        </TouchDragOverlay>
      )}
    </>
  );
};

export default BoardPage;
