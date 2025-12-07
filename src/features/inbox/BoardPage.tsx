import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import ActivityCard from "../day/ActivityCard";
import {
  useActivitiesStore,
  getInboxActivities,
  getLaterActivities,
} from "../../shared/store/activitiesStore";
import type { Activity, Bucket } from "../../shared/types/activity";
import AddActivityModal from "../../shared/components/AddActivityModal";
import { useMediaQuery } from "../../shared/hooks/useMediaQuery";
import { TouchDragOverlay } from "../../shared/components/TouchDragOverlay";

/**
 * Computes a preview order for bucket activities when dragging.
 * Bucket activities (inbox/later) have no time constraints, so order is free.
 */
const computeBucketPreviewOrder = (
  activities: Activity[],
  draggedId: string,
  targetIndex: number
): Activity[] => {
  const dragged = activities.find((a) => a.id === draggedId);
  if (!dragged) return activities;

  const withoutDragged = activities.filter((a) => a.id !== draggedId);
  const clampedIndex = Math.min(Math.max(targetIndex, 0), withoutDragged.length);

  return [
    ...withoutDragged.slice(0, clampedIndex),
    dragged,
    ...withoutDragged.slice(clampedIndex),
  ];
};

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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewInbox, setPreviewInbox] = useState<Activity[] | null>(null);
  const [previewLater, setPreviewLater] = useState<Activity[] | null>(null);
  const dragLeaveTimeoutRef = useRef<number | null>(null);
  const inboxContainerRef = useRef<HTMLDivElement>(null);
  const laterContainerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const isTouchDraggingRef = useRef(false);
  const touchDragBucketRef = useRef<Extract<Bucket, "inbox" | "later"> | null>(null);

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTouchDrag, setIsTouchDrag] = useState(false);
  const [touchDragOverBucket, setTouchDragOverBucket] = useState<Extract<Bucket, "inbox" | "later"> | null>(null);

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
  };

  const handleDragEnd = () => {
    resetDragState();
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    bucket: Extract<Bucket, "inbox" | "later">,
    targetIndex: number
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

    if (bucket === "inbox") {
      // If dragged item is in later, show it being added to inbox
      const targetList = draggedActivity.bucket === "inbox"
        ? inboxActivities
        : [...inboxActivities, draggedActivity];
      const newOrder = computeBucketPreviewOrder(targetList, draggingId, targetIndex);
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
        : [...laterActivities, draggedActivity];
      const newOrder = computeBucketPreviewOrder(targetList, draggingId, targetIndex);
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
    // Check inbox container
    if (inboxContainerRef.current) {
      const rect = inboxContainerRef.current.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return "inbox";
      }
    }
    
    // Check later container
    if (laterContainerRef.current) {
      const rect = laterContainerRef.current.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
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
      setDragOffset({ x: offsetX, y: offsetY });
      setDragPosition({ x: touch.clientX - offsetX, y: touch.clientY - offsetY });
      setPreviewInbox(null);
      setPreviewLater(null);
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    }, 150);
  }, [clearLongPressTimer]);

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
    
    setDragPosition({
      x: touch.clientX - dragOffset.x,
      y: touch.clientY - dragOffset.y
    });

    // Update which bucket we're over
    const targetBucket = getBucketAtPosition(touch.clientX, touch.clientY);
    if (targetBucket) {
      touchDragBucketRef.current = targetBucket;
      setTouchDragOverBucket(targetBucket);
    }
  }, [clearLongPressTimer, getBucketAtPosition, dragOffset]);

  const handleTouchEnd = useCallback((
    activityId: string,
    originalBucket: Extract<Bucket, "inbox" | "later">
  ) => {
    clearLongPressTimer();

    if (isTouchDraggingRef.current) {
      const draggedActivity = activities.find((a) => a.id === activityId);
      const targetBucket = touchDragBucketRef.current || originalBucket;
      
      if (draggedActivity && draggedActivity.bucket !== targetBucket) {
        // Only move to target bucket if it changed
        if (targetBucket === "inbox") {
          moveToInbox(activityId);
        } else {
          moveToLater(activityId);
        }
      }
    }

    isTouchDraggingRef.current = false;
    touchDragBucketRef.current = null;
    setIsTouchDrag(false);
    setDragPosition(null);
    setTouchDragOverBucket(null);
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
    resetDragState();
  }, [clearLongPressTimer, activities, moveToInbox, moveToLater]);

  return (
    <>
      <div className="mx-auto w-full max-w-xl px-4 pt-4 md:pt-0">
        {/* Inbox Section - Always Visible */}
        <div
          ref={inboxContainerRef}
          className="mb-6"
          onDragLeave={handleDragLeave}
        >
          <span className="mb-2 block text-center text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
            Inbox
          </span>
          <div
            className="min-h-20 relative"
            onDragOver={(e) => handleDragOver(e, "inbox", displayInbox.length)}
            onDrop={(e) => handleDrop(e, "inbox", displayInbox.length)}
          >
            {displayInbox.length === 0 && touchDragOverBucket !== "inbox" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-[var(--color-text-subtle)]">
                  Nothing here yet
                </p>
              </div>
            )}
            {displayInbox.map((activity, index) => (
              <div
                key={activity.id}
                data-activity-id={activity.id}
                onDragOver={(e) => handleDragOver(e, "inbox", index)}
                onDrop={(e) => handleDrop(e, "inbox", index)}
              >
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
              </div>
            ))}
          </div>
        </div>

        {/* Later Section - Always Visible */}
        <div
          ref={laterContainerRef}
          className="mb-4"
          onDragLeave={handleDragLeave}
        >
          <span className="mb-2 block text-center text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
            Later
          </span>
          <div
            className="min-h-20 relative"
            onDragOver={(e) => handleDragOver(e, "later", displayLater.length)}
            onDrop={(e) => handleDrop(e, "later", displayLater.length)}
          >
            {displayLater.length === 0 && touchDragOverBucket !== "later" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-[var(--color-text-subtle)]">
                  Nothing here yet
                </p>
              </div>
            )}
            {displayLater.map((activity, index) => (
              <div
                key={activity.id}
                data-activity-id={activity.id}
                onDragOver={(e) => handleDragOver(e, "later", index)}
                onDrop={(e) => handleDrop(e, "later", index)}
              >
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
              </div>
            ))}
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

export default BoardPage;
