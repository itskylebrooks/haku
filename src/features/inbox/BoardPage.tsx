import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { CirclePlus } from "lucide-react";
import ActivityCard from "../day/ActivityCard";
import {
  useActivitiesStore,
  getInboxActivities,
  getLaterActivities,
} from "../../shared/store/activitiesStore";
import type { Activity, Bucket } from "../../shared/types/activity";
import AddActivityModal from "../../shared/components/AddActivityModal";
import { useMediaQuery } from "../../shared/hooks/useMediaQuery";
import { TouchDragOverlay, type TouchDragOverlayHandle } from "../../shared/components/TouchDragOverlay";
import { useAutoScroll } from "../../shared/hooks/useAutoScroll";

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
  const [hoveredCreatePlacement, setHoveredCreatePlacement] = useState<Extract<Bucket, "inbox" | "later"> | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggedCardHeight, setDraggedCardHeight] = useState<number>(72);
  const [previewInbox, setPreviewInbox] = useState<Activity[] | null>(null);
  const [previewLater, setPreviewLater] = useState<Activity[] | null>(null);
  const dragLeaveTimeoutRef = useRef<number | null>(null);
  const inboxContainerRef = useRef<HTMLDivElement>(null);
  const laterContainerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | Window | null>(null);
  const preventDefaultTouchMoveRef = useRef<((e: TouchEvent) => void) | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const isTouchDraggingRef = useRef(false);
  const touchDragBucketRef = useRef<Extract<Bucket, "inbox" | "later"> | null>(null);
  const lastTouchPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isTouchDrag, setIsTouchDrag] = useState(false);
  const [touchDragOverBucket, setTouchDragOverBucket] = useState<Extract<Bucket, "inbox" | "later"> | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialDragPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const overlayRef = useRef<TouchDragOverlayHandle>(null);
  // Cached container rects to avoid layout thrashing during drag
  const inboxRectRef = useRef<DOMRect | null>(null);
  const laterRectRef = useRef<DOMRect | null>(null);
  const lastBucketUpdateRef = useRef<number>(0);

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

  const displayInbox = previewInbox ?? inboxActivities;
  const displayLater = previewLater ?? laterActivities;

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

  const resetDragState = () => {
    setDraggingId(null);
    setPreviewInbox(null);
    setPreviewLater(null);
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, activity: Activity) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", activity.id);
    setDraggingId(activity.id);
    setPreviewInbox(null);
    setPreviewLater(null);

    // Capture the height of the card being dragged
    const target = event.currentTarget;
    if (target) {
      setDraggedCardHeight(target.offsetHeight);
    }
  };

  const handleDragEnd = () => {
    resetDragState();
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    bucket: Extract<Bucket, "inbox" | "later">,
    _targetIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }

    if (!draggingId) return;

    const draggedActivity = activities.find((a) => a.id === draggingId);
    if (!draggedActivity) return;

    // Create placeholder for the gap
    const placeholder: Activity = {
      ...draggedActivity,
      id: '__DRAG_PLACEHOLDER__',
    };

    // Desktop drag: show gap with placeholder
    if (bucket === "inbox") {
      const targetList = draggedActivity.bucket === "inbox"
        ? inboxActivities
        : [...inboxActivities];
      const withoutDragged = targetList.filter((a) => a.id !== draggingId);
      const clampedIndex = Math.min(Math.max(_targetIndex, 0), withoutDragged.length);
      const newOrder = [
        ...withoutDragged.slice(0, clampedIndex),
        placeholder,
        ...withoutDragged.slice(clampedIndex),
      ];
      setPreviewInbox(newOrder);
      // If coming from later, remove from later preview
      if (draggedActivity.bucket === "later") {
        setPreviewLater(laterActivities.filter((a) => a.id !== draggingId));
      } else {
        setPreviewLater(null);
      }
    } else {
      // bucket === "later"
      const targetList = draggedActivity.bucket === "later"
        ? laterActivities
        : [...laterActivities];
      const withoutDragged = targetList.filter((a) => a.id !== draggingId);
      const clampedIndex = Math.min(Math.max(_targetIndex, 0), withoutDragged.length);
      const newOrder = [
        ...withoutDragged.slice(0, clampedIndex),
        placeholder,
        ...withoutDragged.slice(clampedIndex),
      ];
      setPreviewLater(newOrder);
      // If coming from inbox, remove from inbox preview
      if (draggedActivity.bucket === "inbox") {
        setPreviewInbox(inboxActivities.filter((a) => a.id !== draggingId));
      } else {
        setPreviewInbox(null);
      }
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
    }
    dragLeaveTimeoutRef.current = window.setTimeout(() => {
      setPreviewInbox(null);
      setPreviewLater(null);
      dragLeaveTimeoutRef.current = null;
    }, 50);
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    bucket: Extract<Bucket, "inbox" | "later">,
    targetIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const droppedId = draggingId ?? event.dataTransfer.getData("text/plain");
    if (!droppedId) {
      resetDragState();
      return;
    }

    const draggedActivity = activities.find((a) => a.id === droppedId);
    if (!draggedActivity) {
      resetDragState();
      return;
    }

    // Move to target bucket if needed
    if (draggedActivity.bucket !== bucket) {
      if (bucket === "inbox") {
        moveToInbox(droppedId);
      } else {
        moveToLater(droppedId);
      }
    }

    // Compute final order (exclude the dropped item first, then insert)
    const orderedIds = getBucketOrderedIds(bucket, droppedId);
    const clampedIndex = Math.min(Math.max(targetIndex, 0), orderedIds.length);
    orderedIds.splice(clampedIndex, 0, droppedId);
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
    _activityId: string,
    _originalBucket: Extract<Bucket, "inbox" | "later">
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

    // Store the last touch position for computing target index on drop
    lastTouchPosRef.current = { x: touch.clientX, y: touch.clientY };

    // Update which bucket we're over (throttled to avoid excessive re-renders)
    const now = Date.now();
    if (now - lastBucketUpdateRef.current > 50) {
      lastBucketUpdateRef.current = now;
      const targetBucket = getBucketAtPosition(touch.clientX, touch.clientY);
      if (targetBucket && targetBucket !== touchDragBucketRef.current) {
        touchDragBucketRef.current = targetBucket;
        setTouchDragOverBucket(targetBucket);
      }
    }

    // Auto-scroll when near edges
    startAutoScroll(touch.clientY);
  }, [clearLongPressTimer, getBucketAtPosition, startAutoScroll]);

  const handleTouchEnd = useCallback((
    activityId: string,
    originalBucket: Extract<Bucket, "inbox" | "later">
  ) => {
    clearLongPressTimer();

    if (isTouchDraggingRef.current) {
      const draggedActivity = activities.find((a) => a.id === activityId);
      const targetBucket = touchDragBucketRef.current || originalBucket;

      if (draggedActivity) {
        // Move to target bucket if it changed
        if (draggedActivity.bucket !== targetBucket) {
          if (targetBucket === "inbox") {
            moveToInbox(activityId);
          } else {
            moveToLater(activityId);
          }
        }

        // Compute target index from final touch position
        const targetIndex = getTargetIndexFromY(lastTouchPosRef.current.y, targetBucket);

        // Get current ordered IDs excluding the dragged item
        const orderedIds = getBucketOrderedIds(targetBucket, activityId);
        const clampedIndex = Math.min(Math.max(targetIndex, 0), orderedIds.length);
        // Insert the dragged item at the target index
        orderedIds.splice(clampedIndex, 0, activityId);
        reorderInBucket(targetBucket, orderedIds);
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
  }, [clearLongPressTimer, activities, moveToInbox, moveToLater, getBucketOrderedIds, getTargetIndexFromY, reorderInBucket, stopAutoScroll, scrollContainer]);

  const EmptySlot = ({ onClick, label = "New activity" }: { onClick: () => void; label?: string }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group/empty flex min-h-[44px] items-center rounded-md px-3 py-1 cursor-pointer transition hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
    >
      <div className="flex min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-text-meta)] opacity-0 group-hover/empty:opacity-100 transition-opacity">
          {label}
        </p>
      </div>
      <div className="flex-shrink-0 opacity-0 group-hover/empty:opacity-100 transition-opacity">
        <CirclePlus className="h-5 w-5 text-[var(--color-text-meta)]" />
      </div>
    </div>
  );

  // top date removed; no formattedDate needed

  return (
    <>
      <div className="mx-auto w-full max-w-xl px-4 pt-4 lg:pt-0">
        {/* top date header removed per design: no date at top of Board page */}
        {/* Inbox Section - Always Visible */}
        <div
          ref={inboxContainerRef}
          className="mb-6"
          onDragLeave={handleDragLeave}
        >
          <div className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
            Inbox
          </div>
          <div className="h-px w-full rounded-full bg-[var(--color-border-divider)] mb-2" />
          <div
            className="min-h-20 relative mb-6 group/section"
            onDragOver={(e) => handleDragOver(e, "inbox", displayInbox.length)}
            onDrop={(e) => handleDrop(e, "inbox", displayInbox.length)}
          >
            {displayInbox.length === 0 && touchDragOverBucket !== "inbox" && (
              <div
                className={`absolute inset-0 flex items-start justify-center pointer-events-none transition-opacity ${isDesktop && hoveredCreatePlacement === "inbox" ? "opacity-0" : "opacity-100"
                  }`}
              >
                <div className="w-full pt-[20px]">
                  <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                  <div className="h-[30px]" />
                  <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                </div>
              </div>
            )}
            {displayInbox.map((activity, index) => (
              <div
                key={activity.id}
                data-activity-id={activity.id}
                onDragOver={(e) => handleDragOver(e, "inbox", index)}
                onDrop={(e) => handleDrop(e, "inbox", index)}
              >
                {activity.id === '__DRAG_PLACEHOLDER__' ? (
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
              </div>
            ))}
            {/* Desktop placeholder for adding new activity */}
            {isDesktop && !draggingId && (
              <div
                className="hidden lg:block"
                onMouseEnter={() => setHoveredCreatePlacement("inbox")}
                onMouseLeave={() => setHoveredCreatePlacement(null)}
              >
                <EmptySlot
                  label="Add to Inbox"
                  onClick={() => handleOpenCreateModal("inbox")}
                />
              </div>
            )}
          </div>
        </div>

        {/* Later Section - Always Visible */}
        <div
          ref={laterContainerRef}
          className="mb-4"
          onDragLeave={handleDragLeave}
        >
          <div className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
            Later
          </div>
          <div className="h-px w-full rounded-full bg-[var(--color-border-divider)] mb-2" />
          <div
            className="min-h-20 relative mb-4 group/section"
            onDragOver={(e) => handleDragOver(e, "later", displayLater.length)}
            onDrop={(e) => handleDrop(e, "later", displayLater.length)}
          >
            {displayLater.length === 0 && touchDragOverBucket !== "later" && (
              <div
                className={`absolute inset-0 flex items-start justify-center pointer-events-none transition-opacity ${isDesktop && hoveredCreatePlacement === "later" ? "opacity-0" : "opacity-100"
                  }`}
              >
                <div className="w-full pt-[20px]">
                  <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                  <div className="h-[30px]" />
                  <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                </div>
              </div>
            )}
            {displayLater.map((activity, index) => (
              <div
                key={activity.id}
                data-activity-id={activity.id}
                onDragOver={(e) => handleDragOver(e, "later", index)}
                onDrop={(e) => handleDrop(e, "later", index)}
              >
                {activity.id === '__DRAG_PLACEHOLDER__' ? (
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
              </div>
            ))}
            {/* Desktop placeholder for adding new activity */}
            {isDesktop && !draggingId && (
              <div
                className="hidden lg:block"
                onMouseEnter={() => setHoveredCreatePlacement("later")}
                onMouseLeave={() => setHoveredCreatePlacement(null)}
              >
                <EmptySlot
                  label="Add to Later"
                  onClick={() => handleOpenCreateModal("later")}
                />
              </div>
            )}
          </div>
        </div>
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
