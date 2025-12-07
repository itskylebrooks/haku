import { useMemo, useState, useRef, useCallback } from "react";
import ActivityCard from "../day/ActivityCard";
import {
  useActivitiesStore,
  getInboxActivities,
  getLaterActivities,
} from "../../shared/store/activitiesStore";
import type { Activity, Bucket } from "../../shared/types/activity";
import AddActivityModal from "../../shared/components/AddActivityModal";

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

const InboxPage = () => {
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

  const hasInbox = inboxActivities.length > 0 || (previewInbox && previewInbox.length > 0);
  const hasLater = laterActivities.length > 0 || (previewLater && previewLater.length > 0);
  const isEmpty = !hasInbox && !hasLater;

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

    // Compute final order
    const currentList = bucket === "inbox" ? inboxActivities : laterActivities;
    const targetList = draggedActivity.bucket === bucket
      ? currentList
      : [...currentList, draggedActivity];
    const finalOrder = computeBucketPreviewOrder(targetList, droppedId, targetIndex);
    const orderedIds = finalOrder.map((a) => a.id);
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

  const handleTouchStart = useCallback((
    event: React.TouchEvent<HTMLDivElement>,
    activity: Activity,
    bucket: Extract<Bucket, "inbox" | "later">
  ) => {
    const touch = event.touches[0];
    touchStartYRef.current = touch.clientY;
    touchStartXRef.current = touch.clientX;
    isTouchDraggingRef.current = false;
    touchDragBucketRef.current = bucket;

    clearLongPressTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      isTouchDraggingRef.current = true;
      setDraggingId(activity.id);
      setPreviewInbox(null);
      setPreviewLater(null);
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    }, 150);
  }, [clearLongPressTimer]);

  const handleTouchMove = useCallback((
    event: React.TouchEvent<HTMLDivElement>,
    activityId: string,
    bucket: Extract<Bucket, "inbox" | "later">
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
    const targetIndex = getTargetIndexFromY(touch.clientY, bucket);
    
    const draggedActivity = activities.find((a) => a.id === activityId);
    if (!draggedActivity) return;

    if (bucket === "inbox") {
      const targetList = draggedActivity.bucket === "inbox"
        ? inboxActivities
        : [...inboxActivities, draggedActivity];
      const newOrder = computeBucketPreviewOrder(targetList, activityId, targetIndex);
      setPreviewInbox(newOrder);
      if (draggedActivity.bucket === "later") {
        setPreviewLater(laterActivities.filter((a) => a.id !== activityId));
      }
    } else {
      const targetList = draggedActivity.bucket === "later"
        ? laterActivities
        : [...laterActivities, draggedActivity];
      const newOrder = computeBucketPreviewOrder(targetList, activityId, targetIndex);
      setPreviewLater(newOrder);
      if (draggedActivity.bucket === "inbox") {
        setPreviewInbox(inboxActivities.filter((a) => a.id !== activityId));
      }
    }
  }, [clearLongPressTimer, getTargetIndexFromY, activities, inboxActivities, laterActivities]);

  const handleTouchEnd = useCallback((
    activityId: string,
    bucket: Extract<Bucket, "inbox" | "later">
  ) => {
    clearLongPressTimer();

    if (isTouchDraggingRef.current) {
      const draggedActivity = activities.find((a) => a.id === activityId);
      if (draggedActivity) {
        // Move to target bucket if needed
        if (draggedActivity.bucket !== bucket) {
          if (bucket === "inbox") {
            moveToInbox(activityId);
          } else {
            moveToLater(activityId);
          }
        }

        // Use preview order if available
        const previewList = bucket === "inbox" ? previewInbox : previewLater;
        if (previewList) {
          const orderedIds = previewList.map((a) => a.id);
          reorderInBucket(bucket, orderedIds);
        }
      }
    }

    isTouchDraggingRef.current = false;
    touchDragBucketRef.current = null;
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
    resetDragState();
  }, [clearLongPressTimer, activities, moveToInbox, moveToLater, previewInbox, previewLater, reorderInBucket]);

  return (
    <>
      <div className="mx-auto w-full max-w-xl px-4 pt-4 md:pt-0">
        {isEmpty && (
          <div className="py-16 text-center">
            <p className="text-sm text-[var(--color-text-subtle)]">
              No activities on your board yet.
            </p>
          </div>
        )}

        {hasInbox && (
          <div
            ref={inboxContainerRef}
            className="mb-6"
            onDragLeave={handleDragLeave}
          >
            <span className="mb-2 block text-center text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Inbox
            </span>
            <div>
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
                    draggable
                    isDragging={draggingId === activity.id}
                    onDragStart={(e) => handleDragStart(e, activity)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handleTouchStart(e, activity, "inbox")}
                    onTouchMove={(e) => handleTouchMove(e, activity.id, "inbox")}
                    onTouchEnd={() => handleTouchEnd(activity.id, "inbox")}
                  />
                </div>
              ))}
              {/* Drop zone at the end of inbox */}
              <div
                className="h-4"
                onDragOver={(e) => handleDragOver(e, "inbox", displayInbox.length)}
                onDrop={(e) => handleDrop(e, "inbox", displayInbox.length)}
              />
            </div>
          </div>
        )}

        {hasLater && (
          <div
            ref={laterContainerRef}
            className="mb-4"
            onDragLeave={handleDragLeave}
          >
            <span className="mb-2 block text-center text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Later
            </span>
            <div>
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
                    draggable
                    isDragging={draggingId === activity.id}
                    onDragStart={(e) => handleDragStart(e, activity)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handleTouchStart(e, activity, "later")}
                    onTouchMove={(e) => handleTouchMove(e, activity.id, "later")}
                    onTouchEnd={() => handleTouchEnd(activity.id, "later")}
                  />
                </div>
              ))}
              {/* Drop zone at the end of later */}
              <div
                className="h-4"
                onDragOver={(e) => handleDragOver(e, "later", displayLater.length)}
                onDrop={(e) => handleDrop(e, "later", displayLater.length)}
              />
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
    </>
  );
};

export default InboxPage;
