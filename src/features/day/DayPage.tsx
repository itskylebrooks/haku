import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { CirclePlus } from "lucide-react";
import { useActivitiesStore } from "../../shared/store/activitiesStore";
import type { Activity } from "../../shared/types/activity";
import ActivityCard from "./ActivityCard";
import { getDayViewData } from "./daySelectors";
import AddActivityModal from "../../shared/components/AddActivityModal";
import { useMediaQuery } from "../../shared/hooks/useMediaQuery";
import { TouchDragOverlay } from "../../shared/components/TouchDragOverlay";
import { useAutoScroll } from "../../shared/hooks/useAutoScroll";

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
  const reorderInDay = useActivitiesStore((state) => state.reorderInDay);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activityBeingEdited, setActivityBeingEdited] = useState<Activity | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggedCardHeight, setDraggedCardHeight] = useState<number>(72);
  const [previewOrder, setPreviewOrder] = useState<Activity[] | null>(null);
  const dragLeaveTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const isTouchDraggingRef = useRef(false);

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTouchDrag, setIsTouchDrag] = useState(false);

  const { startAutoScroll, stopAutoScroll } = useAutoScroll();

  useEffect(() => {
    if (isTouchDrag) {
      const preventDefault = (e: TouchEvent) => {
        e.preventDefault();
      };
      document.addEventListener("touchmove", preventDefault, { passive: false });
      return () => {
        document.removeEventListener("touchmove", preventDefault);
      };
    }
  }, [isTouchDrag]);

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

    if (draggingId) {
      // Desktop drag: remove dragged card to show gap, no preview card
      const newOrder = computeDesktopPreviewOrder(todayActivities, draggingId, targetIndex);
      setPreviewOrder(newOrder);
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

    const finalOrder = computePreviewOrder(todayActivities, droppedId, targetIndex);
    const orderedIds = finalOrder.map((a) => a.id);
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
      setDragOffset({ x: offsetX, y: offsetY });
      setDragPosition({ x: touch.clientX - offsetX, y: touch.clientY - offsetY });
      setPreviewOrder(null);
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    }, 150);
  }, [clearLongPressTimer]);

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
    
    setDragPosition({
      x: touch.clientX - dragOffset.x,
      y: touch.clientY - dragOffset.y
    });

    const targetIndex = getTargetIndexFromY(touch.clientY);
    const newOrder = computePreviewOrder(todayActivities, activityId, targetIndex);
    setPreviewOrder(newOrder);

    // Auto-scroll when near edges
    startAutoScroll(touch.clientY);
  }, [clearLongPressTimer, getTargetIndexFromY, todayActivities, dragOffset, startAutoScroll]);

  const handleTouchEnd = useCallback((_activityId: string) => {
    clearLongPressTimer();

    if (isTouchDraggingRef.current && previewOrder) {
      const orderedIds = previewOrder.map((a) => a.id);
      reorderInDay(activeDate, orderedIds);
    }

    isTouchDraggingRef.current = false;
    setIsTouchDrag(false);
    setDragPosition(null);
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
    stopAutoScroll();
    resetDragState();
  }, [clearLongPressTimer, previewOrder, reorderInDay, activeDate, stopAutoScroll]);

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
      className="group/empty flex min-h-[44px] items-center rounded-xl px-3 py-1 cursor-pointer transition hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
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
      <div className="mx-auto w-full max-w-xl px-4 pt-4 md:pt-0">
        <h1 className="mb-0 hidden lg:mb-2 lg:block text-center">
          <button
            type="button"
            onClick={onResetToday}
            className="text-xl font-semibold text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
          >
            {formattedDate}
          </button>
        </h1>
        {/* Overdue section */}
        {hasOverdue && (
          <div className="mb-4">
            <div className="mb-2 text-sm font-semibold text-[var(--color-text-subtle)] md:text-[var(--color-text-primary)]">
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
                />
              ))}
            </div>
          </div>
        )}

        {/* Today section */}
        <div
          ref={containerRef}
          className="mt-3 md:mt-5 lg:mt-0"
          onDragLeave={handleDragLeave}
        >
          <div className="mb-2">
            <button
              type="button"
              onClick={onResetToday}
              className="text-sm font-semibold text-[var(--color-text-subtle)] md:text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
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
                  <div className="hidden md:block">
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
                  <div className="absolute inset-0 flex items-center md:block opacity-0 pointer-events-none transition-opacity duration-150 group-hover/quiet:opacity-100 group-hover/quiet:pointer-events-auto">
                    <EmptySlot label="Add to Today" onClick={handleOpenCreateModal} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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

      {/* Touch Drag Overlay */}
      {isTouchDrag && draggingId && dragPosition && (
        <TouchDragOverlay x={dragPosition.x} y={dragPosition.y}>
          <div className="w-[calc(100vw-32px)] max-w-xl pointer-events-none">
            {(() => {
              const activity = activities.find((a) => a.id === draggingId);
              if (!activity) return null;
              return (
                <div className="shadow-xl rounded-xl bg-[var(--color-surface)]">
                  <ActivityCard
                    activity={activity}
                    onToggleDone={() => {}}
                    onEdit={() => {}}
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
