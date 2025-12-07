import { useMemo, useState, useRef, useCallback } from "react";
import { useActivitiesStore } from "../../shared/store/activitiesStore";
import type { Activity } from "../../shared/types/activity";
import ActivityCard from "./ActivityCard";
import { getDayViewData } from "./daySelectors";
import AddActivityModal from "../../shared/components/AddActivityModal";

interface DayPageProps {
  activeDate: string;
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

const DayPage = ({ activeDate }: DayPageProps) => {
  const activities = useActivitiesStore((state) => state.activities);
  const toggleDone = useActivitiesStore((state) => state.toggleDone);
  const deleteActivity = useActivitiesStore((state) => state.deleteActivity);
  const updateActivity = useActivitiesStore((state) => state.updateActivity);
  const reorderInDay = useActivitiesStore((state) => state.reorderInDay);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activityBeingEdited, setActivityBeingEdited] = useState<Activity | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<Activity[] | null>(null);
  const dragLeaveTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const isTouchDraggingRef = useRef(false);

  const { overdue, todayAnchored, todayFlexible } = useMemo(
    () => getDayViewData(activities, activeDate),
    [activities, activeDate]
  );

  const todayActivities = useMemo(
    () => [...todayAnchored, ...todayFlexible],
    [todayAnchored, todayFlexible]
  );

  const displayActivities = previewOrder ?? todayActivities;

  const hasOverdue = overdue.length > 0;
  const hasTodayActivities = todayActivities.length > 0;
  const isEmpty = !hasOverdue && !hasTodayActivities;

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
      const newOrder = computePreviewOrder(todayActivities, draggingId, targetIndex);
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
    touchStartYRef.current = touch.clientY;
    touchStartXRef.current = touch.clientX;
    isTouchDraggingRef.current = false;

    clearLongPressTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      isTouchDraggingRef.current = true;
      setDraggingId(activity.id);
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
    const targetIndex = getTargetIndexFromY(touch.clientY);
    const newOrder = computePreviewOrder(todayActivities, activityId, targetIndex);
    setPreviewOrder(newOrder);
  }, [clearLongPressTimer, getTargetIndexFromY, todayActivities]);

  const handleTouchEnd = useCallback((_activityId: string) => {
    clearLongPressTimer();

    if (isTouchDraggingRef.current && previewOrder) {
      const orderedIds = previewOrder.map((a) => a.id);
      reorderInDay(activeDate, orderedIds);
    }

    isTouchDraggingRef.current = false;
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
    resetDragState();
  }, [clearLongPressTimer, previewOrder, reorderInDay, activeDate]);

  return (
    <>
      <div className="mx-auto w-full max-w-xl px-4 pt-4 md:pt-0">
        {/* Empty state */}
        {isEmpty && (
          <div className="py-16 text-center">
            <p className="text-sm text-[var(--color-text-subtle)]">
              No activities for this day yet.
            </p>
          </div>
        )}

        {/* Overdue section */}
        {hasOverdue && (
          <div className="mb-4">
            <span className="mb-2 block text-center text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Overdue
            </span>
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
        {hasTodayActivities && (
          <div
            ref={containerRef}
            className={!hasOverdue ? "mt-3 md:mt-5" : ""}
            onDragLeave={handleDragLeave}
          >
            {hasOverdue && (
              <span className="mb-2 block text-center text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Today
              </span>
            )}
            {displayActivities.map((activity, index) => (
              <div
                key={activity.id}
                data-activity-id={activity.id}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
              >
                <ActivityCard
                  activity={activity}
                  onToggleDone={handleToggleDone}
                  onEdit={handleEdit}
                  draggable
                  isDragging={draggingId === activity.id}
                  onDragStart={(e) => handleDragStart(e, activity)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) => handleTouchStart(e, activity)}
                  onTouchMove={(e) => handleTouchMove(e, activity.id)}
                  onTouchEnd={() => handleTouchEnd(activity.id)}
                />
              </div>
            ))}
            {/* Drop zone at the end */}
            <div
              className="h-8"
              onDragOver={(e) => handleDragOver(e, displayActivities.length)}
              onDrop={(e) => handleDrop(e, displayActivities.length)}
            />
          </div>
        )}
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
    </>
  );
};

export default DayPage;
