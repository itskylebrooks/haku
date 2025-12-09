import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { CirclePlus } from "lucide-react";
import { useActivitiesStore } from "../../shared/store/activitiesStore";
import type { Activity } from "../../shared/types/activity";
import ActivityCard from "./ActivityCard";
import { getDayViewData } from "./daySelectors";
import AddActivityModal from "../../shared/components/AddActivityModal";
import { useMediaQuery } from "../../shared/hooks/useMediaQuery";
import { TouchDragOverlay, type TouchDragOverlayHandle } from "../../shared/components/TouchDragOverlay";
import { useAutoScroll } from "../../shared/hooks/useAutoScroll";
import { useThrottledCallback } from "../../shared/hooks/useThrottle";

interface DayPageProps {
  activeDate: string;
  onResetToday?: () => void;
}

/**
 * Computes a preview order for activities when dragging.
 * Follows the same rules as the WeekPage: anchored activities (with time)
 * maintain their relative time-based order; flexible activities can be reordered freely.
 */
const computePreviewOrder = (
  activities: Activity[],
  draggedId: string,
  targetIndex: number
): Activity[] => {
  const dragged = activities.find((a) => a.id === draggedId);
  if (!dragged) return activities;

  const withoutDragged = activities.filter((a) => a.id !== draggedId);
  const clampedIndex = Math.min(Math.max(targetIndex, 0), withoutDragged.length);

  const merged = [
    ...withoutDragged.slice(0, clampedIndex),
    dragged,
    ...withoutDragged.slice(clampedIndex),
  ];

  // Anchored activities must maintain their time order
  const anchored = merged.filter((a) => a.time !== null).sort((a, b) => {
    if (a.time === null || b.time === null) return 0;
    return a.time.localeCompare(b.time);
  });

  let anchoredPtr = 0;
  return merged.map((item) => {
    if (item.time !== null) {
      return anchored[anchoredPtr++];
    }
    return item;
  });
};

/**
 * Computes preview order for desktop drag - shows gap without the dragged card.
 * Returns cards reordered with a placeholder at the drop position.
 */
const computeDesktopPreviewOrder = (
  activities: Activity[],
  draggedId: string,
  targetIndex: number
): Activity[] => {
  const dragged = activities.find((a) => a.id === draggedId);
  if (!dragged) return activities;

  const withoutDragged = activities.filter((a) => a.id !== draggedId);
  const clampedIndex = Math.min(Math.max(targetIndex, 0), withoutDragged.length);

  // Create a placeholder that will render as empty space
  const placeholder: Activity = {
    ...dragged,
    id: '__DRAG_PLACEHOLDER__',
  };

  const merged = [
    ...withoutDragged.slice(0, clampedIndex),
    placeholder,
    ...withoutDragged.slice(clampedIndex),
  ];

  // Anchored activities must maintain their time order
  const anchored = merged.filter((a) => a.time !== null).sort((a, b) => {
    if (a.time === null || b.time === null) return 0;
    return a.time.localeCompare(b.time);
  });

  let anchoredPtr = 0;
  return merged.map((item) => {
    if (item.time !== null) {
      return anchored[anchoredPtr++];
    }
    return item;
  });
};

const DayPage = ({ activeDate, onResetToday }: DayPageProps) => {
  const activities = useActivitiesStore((state) => state.activities);
  const toggleDone = useActivitiesStore((state) => state.toggleDone);
  const deleteActivity = useActivitiesStore((state) => state.deleteActivity);
  const updateActivity = useActivitiesStore((state) => state.updateActivity);
  const scheduleActivity = useActivitiesStore((state) => state.scheduleActivity);
  const reorderInDay = useActivitiesStore((state) => state.reorderInDay);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activityBeingEdited, setActivityBeingEdited] = useState<Activity | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggedCardHeight, setDraggedCardHeight] = useState<number>(72);
  const [previewOrder, setPreviewOrder] = useState<Activity[] | null>(null);
  const dragLeaveTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | Window | null>(null);
  const preventDefaultTouchMoveRef = useRef<((e: TouchEvent) => void) | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const isTouchDraggingRef = useRef(false);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isTouchDrag, setIsTouchDrag] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialDragPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const overlayRef = useRef<TouchDragOverlayHandle>(null);

  const { startAutoScroll, stopAutoScroll } = useAutoScroll(scrollContainer ?? window);

  // Throttle preview order updates to max 30fps for better performance on Android
  const throttledSetPreviewOrder = useThrottledCallback(
    (order: Activity[] | null) => setPreviewOrder(order),
    32
  );

  // Cleanup effect to ensure styles are always reset on unmount or when drag ends unexpectedly
  useEffect(() => {
    return () => {
      // Cleanup on unmount
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

  const { overdue, todayAnchored, todayFlexible } = useMemo(
    () => getDayViewData(activities, activeDate),
    [activities, activeDate]
  );

  const todayActivities = useMemo(() => {
    // Combine anchored and flexible activities, then sort by orderIndex
    const combined = [...todayAnchored, ...todayFlexible];

    // Sort by orderIndex if present, maintaining time-based order for anchored activities
    combined.sort((a, b) => {
      // Both have orderIndex - use it
      if (a.orderIndex !== null && b.orderIndex !== null) {
        return a.orderIndex - b.orderIndex;
      }
      // Only a has orderIndex - it comes first
      if (a.orderIndex !== null) {
        return -1;
      }
      // Only b has orderIndex - it comes first
      if (b.orderIndex !== null) {
        return 1;
      }
      // Neither has orderIndex - anchored activities sorted by time come before flexible
      if (a.time !== null && b.time !== null) {
        return a.time.localeCompare(b.time);
      }
      if (a.time !== null) {
        return -1;
      }
      if (b.time !== null) {
        return 1;
      }
      // Both flexible without orderIndex - sort by createdAt
      return a.createdAt.localeCompare(b.createdAt);
    });

    return combined;
  }, [todayAnchored, todayFlexible]);

  const displayActivities = previewOrder ?? todayActivities;

  const hasOverdue = overdue.length > 0;
  const hasDisplayActivities = displayActivities.length > 0;

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

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleDeleteActivity = (id: string) => {
    deleteActivity(id);
    handleCloseEditModal();
  };

  const resetDragState = () => {
    setDraggingId(null);
    setPreviewOrder(null);
    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, activity: Activity) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", activity.id);
    setDraggingId(activity.id);
    setPreviewOrder(null);

    // Capture the height of the card being dragged
    const target = event.currentTarget;
    if (target) {
      setDraggedCardHeight(target.offsetHeight);
    }
  };

  const handleDragEnd = () => {
    resetDragState();
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
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

    // Desktop drag from same day: show gap placeholder as before
    if (draggedActivity.bucket === "scheduled" && draggedActivity.date === activeDate) {
      const newOrder = computeDesktopPreviewOrder(todayActivities, draggingId, targetIndex);
      setPreviewOrder(newOrder);
      return;
    }

    // Desktop drag from Overdue (scheduled but earlier date): allow dropping into Today
    if (draggedActivity.bucket === "scheduled" && draggedActivity.date !== activeDate) {
      // Build placeholder based on dragged activity
      const placeholder: Activity = {
        ...draggedActivity,
        id: "__DRAG_PLACEHOLDER__",
      };
      const withoutDragged = [...todayActivities];
      const clampedIndex = Math.min(Math.max(targetIndex, 0), withoutDragged.length);
      const merged = [
        ...withoutDragged.slice(0, clampedIndex),
        placeholder,
        ...withoutDragged.slice(clampedIndex),
      ];

      // Maintain anchored time order
      const anchored = merged.filter((a) => a.time !== null).sort((a, b) => {
        if (a.time === null || b.time === null) return 0;
        return a.time.localeCompare(b.time);
      });
      let anchoredPtr = 0;
      const ordered = merged.map((item) => {
        if (item.time !== null) {
          return anchored[anchoredPtr++];
        }
        return item;
      });
      setPreviewOrder(ordered);
      return;
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
      setPreviewOrder(null);
      dragLeaveTimeoutRef.current = null;
    }, 50);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    event.stopPropagation();

    const droppedId = draggingId ?? event.dataTransfer.getData("text/plain");
    if (!droppedId) {
      resetDragState();
      return;
    }

    const draggedActivity = activities.find((a) => a.id === droppedId);
    // If the dragged activity is not already scheduled for this date, schedule it for today
    if (draggedActivity && !(draggedActivity.bucket === "scheduled" && draggedActivity.date === activeDate)) {
      scheduleActivity(droppedId, activeDate);
    }

    // Compute final ordered IDs; use previewOrder if available
    const finalOrder = previewOrder ?? (() => {
      const current = [...todayActivities];
      const clampedIndex = Math.min(Math.max(targetIndex, 0), current.length);
      current.splice(clampedIndex, 0, activities.find((a) => a.id === droppedId) ?? ({} as Activity));
      return current;
    })();

    // Replace placeholder id with real id if necessary
    const orderedIds = finalOrder.map((a) => (a.id === "__DRAG_PLACEHOLDER__" ? droppedId : a.id));
    reorderInDay(activeDate, orderedIds);

    resetDragState();
  };

  // Touch drag handlers for mobile
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const getTargetIndexFromY = useCallback((clientY: number): number => {
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

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>, activity: Activity) => {
    const touch = event.touches[0];
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;

    touchStartYRef.current = touch.clientY;
    touchStartXRef.current = touch.clientX;
    isTouchDraggingRef.current = false;

    clearLongPressTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      isTouchDraggingRef.current = true;
      setDraggingId(activity.id);
      setIsTouchDrag(true);
      // Store offset in ref for imperative updates (no re-render)
      dragOffsetRef.current = { x: offsetX, y: offsetY };
      initialDragPosRef.current = { x: touch.clientX - offsetX, y: touch.clientY - offsetY };
      setPreviewOrder(null);
      const preventDefault = (e: TouchEvent) => e.preventDefault();
      preventDefaultTouchMoveRef.current = preventDefault;
      document.addEventListener("touchmove", preventDefault, { passive: false });
      // Prevent pull-to-refresh on Android
      document.body.style.overscrollBehavior = "none";
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
  }, [clearLongPressTimer, containerRef, scrollContainer]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>, activityId: string) => {
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

    const targetIndex = getTargetIndexFromY(touch.clientY);
    const draggedActivity = activities.find((a) => a.id === activityId);
    if (!draggedActivity) return;

    // If dragged activity is already in today's list, use computePreviewOrder
    if (draggedActivity.bucket === "scheduled" && draggedActivity.date === activeDate) {
      const newOrder = computePreviewOrder(todayActivities, activityId, targetIndex);
      // Throttled to prevent too many re-renders
      throttledSetPreviewOrder(newOrder);
    } else {
      // External drag (from Overdue): build placeholder and insert into today's list
      const placeholder: Activity = {
        ...draggedActivity,
        id: '__DRAG_PLACEHOLDER__',
      };
      const without = [...todayActivities];
      const clampedIndex = Math.min(Math.max(targetIndex, 0), without.length);
      const merged = [
        ...without.slice(0, clampedIndex),
        placeholder,
        ...without.slice(clampedIndex),
      ];
      // Maintain anchored order
      const anchored = merged.filter((a) => a.time !== null).sort((a, b) => {
        if (a.time === null || b.time === null) return 0;
        return a.time.localeCompare(b.time);
      });
      let anchoredPtr = 0;
      const ordered = merged.map((item) => {
        if (item.time !== null) {
          return anchored[anchoredPtr++];
        }
        return item;
      });
      // Throttled to prevent too many re-renders
      throttledSetPreviewOrder(ordered);
    }

    // Auto-scroll when near edges
    startAutoScroll(touch.clientY);
  }, [clearLongPressTimer, getTargetIndexFromY, todayActivities, startAutoScroll, throttledSetPreviewOrder, activities, activeDate]);

  const handleTouchEnd = useCallback((_activityId: string) => {
    clearLongPressTimer();

    if (isTouchDraggingRef.current && previewOrder) {
      const droppedId = draggingId ?? _activityId;
      const draggedActivity = activities.find((a) => a.id === droppedId);
      if (draggedActivity && !(draggedActivity.bucket === "scheduled" && draggedActivity.date === activeDate)) {
        scheduleActivity(droppedId, activeDate);
      }

      const finalOrderedIds = previewOrder.map((a) => (a.id === '__DRAG_PLACEHOLDER__' ? droppedId : a.id));
      reorderInDay(activeDate, finalOrderedIds);
    }

    isTouchDraggingRef.current = false;
    setIsTouchDrag(false);
    // Reset all scroll-related styles including overscrollBehavior
    document.body.style.overscrollBehavior = "";
    if (scrollContainer && scrollContainer instanceof HTMLElement) {
      scrollContainer.style.overflow = "";
      scrollContainer.style.touchAction = "";
      scrollContainer.style.overscrollBehavior = "";
    } else if (containerRef.current) {
      containerRef.current.style.overflow = "";
      containerRef.current.style.touchAction = "";
      containerRef.current.style.overscrollBehavior = "";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    if (preventDefaultTouchMoveRef.current) {
      document.removeEventListener("touchmove", preventDefaultTouchMoveRef.current);
      preventDefaultTouchMoveRef.current = null;
    }
    stopAutoScroll();
    resetDragState();
  }, [clearLongPressTimer, previewOrder, reorderInDay, activeDate, stopAutoScroll, scrollContainer, activities, scheduleActivity, draggingId]);

  const formattedDate = useMemo(() => {
    if (!activeDate) return "";
    const date = new Date(`${activeDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return activeDate;
    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [activeDate]);

  const EmptySlot = ({ onClick, label = "Add activity" }: { onClick: () => void; label?: string }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
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

  const canShowDesktopAddSlot = isDesktop && !draggingId;

  return (
    <>
      <div className="mx-auto w-full max-w-xl px-4 pt-4 lg:pt-0">
        {/* top date header removed per design: no date at top of Day page */}
        {/* NOTE: Overdue section intentionally moved below Today's section */}

        {/* Today section */}
        <div
          ref={containerRef}
          className={`mt-0 md:mt-5 lg:mt-0`}
          onDragLeave={handleDragLeave}
        >
          <div className="mb-2">
            <button
              type="button"
              onClick={onResetToday}
              className="text-base font-semibold text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
              aria-label="Go to today"
            >
              {isDesktop ? formattedDate : "Today"}
            </button>
          </div>
          <div className="h-px w-full rounded-full bg-[var(--color-border-divider)] mb-2" />
          {hasDisplayActivities ? (
            <>
              {displayActivities.map((activity, index) => (
                <div
                  key={activity.id}
                  data-activity-id={activity.id}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
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
                      onTouchStart={(e) => handleTouchStart(e, activity)}
                      onTouchMove={(e) => handleTouchMove(e, activity.id)}
                      onTouchEnd={() => handleTouchEnd(activity.id)}
                    />
                  )}
                </div>
              ))}
              {/* Drop zone + desktop add slot */}
              <div
                onDragOver={(e) => handleDragOver(e, displayActivities.length)}
                onDrop={(e) => handleDrop(e, displayActivities.length)}
              >
                {canShowDesktopAddSlot ? (
                  <div className="hidden lg:block">
                    <EmptySlot label="Add to Today" onClick={handleOpenCreateModal} />
                  </div>
                ) : (
                  <div className="h-8" />
                )}
              </div>
            </>
          ) : (
            <div
              className={`text-left ${canShowDesktopAddSlot ? "group/quiet" : ""}`}
              onDragOver={(e) => handleDragOver(e, 0)}
              onDrop={(e) => handleDrop(e, 0)}
            >

              <div className="py-4 min-h-[44px] relative flex items-center justify-center px-2">
                <p className={`text-sm text-[var(--color-text-subtle)] transition-opacity transform -translate-y-1 ${canShowDesktopAddSlot ? "group-hover/quiet:opacity-0" : ""}`}>
                  A quiet day.
                </p>

                {canShowDesktopAddSlot && (
                  <div className="absolute inset-0 flex items-center lg:block opacity-0 pointer-events-none transition-opacity duration-150 group-hover/quiet:opacity-100 group-hover/quiet:pointer-events-auto">
                    <EmptySlot label="Add to Today" onClick={handleOpenCreateModal} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overdue section (moved to below Today's section) */}
      {hasOverdue && (
        <div className="mt-3 mb-4 mx-auto w-full max-w-xl px-4">
          <div className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
            Overdue
          </div>
          <div className="h-px w-full rounded-full bg-[var(--color-border-divider)] mb-2" />
          <div>
            {overdue.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onToggleDone={handleToggleDone}
                onEdit={handleEdit}
                draggable={isDesktop}
                isDragging={draggingId === activity.id}
                disableHover={draggingId !== null}
                onDragStart={(e) => handleDragStart(e, activity)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, activity)}
                onTouchMove={(e) => handleTouchMove(e, activity.id)}
                onTouchEnd={() => handleTouchEnd(activity.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <AddActivityModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        mode="edit"
        activityToEdit={activityBeingEdited ?? undefined}
        onDelete={handleDeleteActivity}
        onUpdate={updateActivity}
        defaultDate={activeDate}
      />

      {/* Create Modal */}
      <AddActivityModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        mode="create"
        initialPlacement="scheduled"
        defaultDate={activeDate}
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

export default DayPage;
