import type React from "react";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { CirclePlus, FlagTriangleRight } from "lucide-react";
import ActivityCard from "../day/ActivityCard";
import { useActivitiesStore, getInboxActivities, getLaterActivities } from "../../shared/store/activitiesStore";
import type { Activity, Bucket } from "../../shared/types/activity";
import AddActivityModal from "../../shared/components/AddActivityModal";
import WeekActivityRow from "./WeekActivityRow";
import {
  getWeekActivities,
  getWeekDates,
  getWeekStartDate,
} from "./weekSelectors";
import { distributeIntoTwoColumns } from "./columnDistribution";
import { useMediaQuery } from "../../shared/hooks/useMediaQuery";
import { TouchDragOverlay, type TouchDragOverlayHandle } from "../../shared/components/TouchDragOverlay";
import { useAutoScroll } from "../../shared/hooks/useAutoScroll";

interface WeekPageProps {
  activeDate: string;
  weekStart: "monday" | "sunday";
  onResetToday?: () => void;
}

const formatMobileDayLabel = (isoDate: string): { weekday: string; monthDay: string } => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return { weekday: isoDate, monthDay: "" };

  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const monthDay = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return { weekday, monthDay };
};

const formatDesktopDayLabel = (isoDate: string): { weekday: string; monthDay: string } => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { weekday: isoDate, monthDay: "" };
  }

  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const monthDay = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return { weekday, monthDay };
};

/**
 * Computes a preview order for activities when dragging on mobile.
 * Follows the same rules as desktop: anchored activities (with time)
 * maintain their relative time-based order; flexible activities can be reordered freely.
 */
const computeMobilePreviewOrder = (
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

const WeekPage = ({ activeDate, weekStart, onResetToday }: WeekPageProps) => {
  const activities = useActivitiesStore((state) => state.activities);
  const toggleDone = useActivitiesStore((state) => state.toggleDone);
  const deleteActivity = useActivitiesStore((state) => state.deleteActivity);
  const updateActivity = useActivitiesStore((state) => state.updateActivity);
  const moveToInbox = useActivitiesStore((state) => state.moveToInbox);
  const moveToLater = useActivitiesStore((state) => state.moveToLater);
  const scheduleActivity = useActivitiesStore((state) => state.scheduleActivity);
  const reorderInDay = useActivitiesStore((state) => state.reorderInDay);
  const reorderInBucket = useActivitiesStore((state) => state.reorderInBucket);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activityBeingEdited, setActivityBeingEdited] = useState<Activity | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newActivityDate, setNewActivityDate] = useState<string | null>(null);
  const [newActivityPlacement, setNewActivityPlacement] = useState<Bucket>("scheduled");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [mobilePreviewOrder, setMobilePreviewOrder] = useState<Record<string, Activity[]>>({});
  const [mobileDragOverDate, setMobileDragOverDate] = useState<string | null>(null);
  const dragLeaveTimeoutRef = useRef<number | null>(null);
  const mobileContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | Window | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const isTouchDraggingRef = useRef(false);
  const touchDragDateRef = useRef<string | null>(null);
  const lastTouchPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const preventDefaultTouchMoveRef = useRef<((e: TouchEvent) => void) | null>(null);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isTouchDrag, setIsTouchDrag] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialDragPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const overlayRef = useRef<TouchDragOverlayHandle>(null);
  // Cached date container rects to avoid layout thrashing during drag
  const cachedDateRectsRef = useRef<Record<string, DOMRect>>({});
  const lastDateUpdateRef = useRef<number>(0);

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

  // Find the nearest main scroll container within AppShell (default) once mounted
  useEffect(() => {
    if (typeof document === "undefined") return;
    const main = document.querySelector("main") as HTMLElement | null;
    if (main) {
      setScrollContainer(main);
    } else {
      setScrollContainer(window);
    }
  }, []);

  const weekStartDate = useMemo(
    () => getWeekStartDate(activeDate, weekStart),
    [activeDate, weekStart]
  );
  const weekDates = useMemo(
    () => getWeekDates(weekStartDate),
    [weekStartDate]
  );
  // The layout displays 6 columns in the primary row and one extra column in the
  // secondary row. Instead of hard-coding Sunday as the extra column, use the
  // 7th item from `weekDates` so the UI adapts when the first day of the week
  // (weekStart) changes.
  const topWeekDates = useMemo(() => weekDates.slice(0, 6), [weekDates]);
  const extraDate = useMemo(() => weekDates.length === 7 ? weekDates[6] : null, [weekDates]);

  // Callback to refresh cached date container rects during autoscroll
  const refreshCachedRects = useCallback(() => {
    for (const date of weekDates) {
      const container = mobileContainerRefs.current[date];
      if (container) {
        cachedDateRectsRef.current[date] = container.getBoundingClientRect();
      }
    }
  }, [weekDates]);

  const { startAutoScroll, stopAutoScroll } = useAutoScroll({
    scrollContainer: scrollContainer ?? window,
    onScrolling: refreshCachedRects,
  });
  const weekActivities = useMemo(
    () => getWeekActivities(activities, weekStartDate),
    [activities, weekStartDate]
  );
  const inboxActivities = useMemo(
    () => getInboxActivities(activities),
    [activities]
  );
  const laterActivities = useMemo(
    () => getLaterActivities(activities),
    [activities]
  );
  const [inboxPrimary, inboxSecondary] = useMemo(
    () => distributeIntoTwoColumns(inboxActivities),
    [inboxActivities]
  );
  const [laterPrimary, laterSecondary] = useMemo(
    () => distributeIntoTwoColumns(laterActivities),
    [laterActivities]
  );
  const desktopMaxDividerCount = useMemo(() => {
    const counts = topWeekDates.map((date) => weekActivities[date]?.length ?? 0);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
    return Math.max(5, maxCount);
  }, [weekActivities, topWeekDates]);

  const Divider = ({
    isActive = false,
    onDragOver,
    onDragLeave,
    onDrop,
  }: {
    isActive?: boolean;
    onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  }) => (
    <div
      className="flex h-[2px] items-center w-full"
      onDragOver={(event) => {
        if (onDragOver) {
          event.preventDefault();
          onDragOver(event);
        }
      }}
      onDragLeave={(event) => {
        if (onDragLeave) {
          onDragLeave(event);
        }
      }}
      onDrop={(event) => {
        if (onDrop) {
          event.preventDefault();
          onDrop(event);
        }
      }}
    >
      <div
        className={`h-px w-full rounded-full transition-colors ${isActive ? "bg-[var(--color-text-meta)]" : "bg-[var(--color-border-divider)]"
          }`}
      />
    </div>
  );

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
      className="group/empty flex min-h-[38px] items-center rounded-lg px-1.5 py-1 cursor-pointer transition hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
    >
      <div className="flex min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--color-text-meta)] opacity-0 group-hover/empty:opacity-100 transition-opacity">
          {label}
        </p>
      </div>
      <div className="flex-shrink-0 opacity-0 group-hover/empty:opacity-100 transition-opacity">
        <CirclePlus className="h-4 w-4 text-[var(--color-text-meta)]" />
      </div>
    </div>
  );

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

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewActivityDate(null);
    setNewActivityPlacement("scheduled");
  };

  const handleOpenCreateModal = ({
    date = null,
    placement = "scheduled",
  }: {
    date?: string | null;
    placement?: Bucket;
  }) => {
    setNewActivityDate(date);
    setNewActivityPlacement(placement);
    setIsCreateModalOpen(true);
  };

  const makeDayZoneKey = (date: string, zoneIndex: number) => `day-zone-${date}-${zoneIndex}`;
  const makeDayAppendKey = (date: string) => `day-append-${date}`;
  const makeBucketZoneKey = (bucket: Extract<Bucket, "inbox" | "later">, zoneIndex: number) =>
    `bucket-${bucket}-zone-${zoneIndex}`;

  const findActivityById = (id: string | null): Activity | null =>
    id ? activities.find((activity) => activity.id === id) ?? null : null;

  const resetDragState = () => {
    setDraggingId(null);
    setDragOverKey(null);
  };

  const getBucketOrderedIds = (
    bucket: Extract<Bucket, "inbox" | "later">,
    excludeId?: string
  ): string[] => {
    const items = bucket === "inbox" ? inboxActivities : laterActivities;
    return items.filter((activity) => activity.id !== excludeId).map((activity) => activity.id);
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, activity: Activity) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", activity.id);
    setDraggingId(activity.id);
    setDragOverKey(null);
  };

  const handleDragEnd = () => {
    resetDragState();
  };

  const handleDragOverZone = (event: React.DragEvent<HTMLElement>, key: string) => {
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
  };

  const clearDragKey = (key: string) => {
    if (dragOverKey === key) {
      setDragOverKey(null);
    }
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
      clearDragKey(key);
      dragLeaveTimeoutRef.current = null;
    }, 50);
  };

  const getFlexibleIdsForDate = (date: string, excludeId?: string): string[] => {
    const itemsForDay = weekActivities[date] ?? [];
    return itemsForDay
      .filter((activity) => activity.time === null && activity.id !== excludeId)
      .map((activity) => activity.id);
  };

  const handleDropOnDay = (
    event: React.DragEvent<HTMLDivElement>,
    date: string,
    targetIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const droppedId = draggingId ?? event.dataTransfer.getData("text/plain");
    const activity = findActivityById(droppedId);

    if (!activity) {
      resetDragState();
      return;
    }

    const sourceDate = activity.bucket === "scheduled" ? activity.date : null;
    const isFlexible = activity.time === null;

    if (activity.bucket !== "scheduled" || activity.date !== date) {
      scheduleActivity(activity.id, date);
    }

    const currentDayItems = weekActivities[date] ?? [];
    const currentIndex = currentDayItems.findIndex((item) => item.id === activity.id);
    let adjustedIndex = targetIndex;
    if (sourceDate === date && currentIndex >= 0) {
      if (targetIndex > currentIndex) {
        adjustedIndex = targetIndex - 1;
      }
    }
    const withoutDropped = currentDayItems.filter((item) => item.id !== activity.id);
    const clampedIndex = Math.min(Math.max(adjustedIndex, 0), withoutDropped.length);
    const merged = [
      ...withoutDropped.slice(0, clampedIndex),
      activity,
      ...withoutDropped.slice(clampedIndex),
    ];

    const anchored = merged.filter((item) => item.time !== null).sort((a, b) => {
      if (a.time === null || b.time === null) return 0;
      return a.time.localeCompare(b.time);
    });
    let anchoredPtr = 0;
    const finalOrder = merged.map((item) => {
      if (item.time !== null) {
        return anchored[anchoredPtr++];
      }
      return item;
    });

    const orderedIds = finalOrder.map((item, index) => ({ id: item.id, idx: index }));
    orderedIds.sort((a, b) => a.idx - b.idx);
    reorderInDay(date, orderedIds.map((o) => o.id));

    if (isFlexible && sourceDate && sourceDate !== date) {
      const remainingSource = getFlexibleIdsForDate(sourceDate, activity.id);
      reorderInDay(sourceDate, remainingSource);
    } else if (!isFlexible && sourceDate && sourceDate !== date) {
      const remainingSource = getFlexibleIdsForDate(sourceDate, activity.id);
      reorderInDay(sourceDate, remainingSource);
    }

    resetDragState();
  };

  const handleDropToBucket = (
    event: React.DragEvent<HTMLElement>,
    bucket: Extract<Bucket, "inbox" | "later">,
    targetIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const droppedId = draggingId ?? event.dataTransfer.getData("text/plain");
    const activity = findActivityById(droppedId);

    if (!activity) {
      resetDragState();
      return;
    }

    const sourceDate = activity.bucket === "scheduled" ? activity.date : null;
    const isFlexibleScheduled = activity.bucket === "scheduled" && activity.time === null;

    if (bucket === "inbox") {
      moveToInbox(activity.id);
    } else {
      moveToLater(activity.id);
    }

    const orderedIds = getBucketOrderedIds(bucket, activity.id);
    const clampedIndex = Math.min(Math.max(targetIndex, 0), orderedIds.length);
    orderedIds.splice(clampedIndex, 0, activity.id);
    reorderInBucket(bucket, orderedIds);

    if (isFlexibleScheduled && sourceDate) {
      const remainingSource = getFlexibleIdsForDate(sourceDate, activity.id);
      reorderInDay(sourceDate, remainingSource);
    }

    resetDragState();
  };

  // Mobile drag handlers
  const handleMobileDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    date: string,
    targetIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }

    if (draggingId) {
      const activitiesForDay = weekActivities[date] ?? [];
      const newOrder = computeMobilePreviewOrder(activitiesForDay, draggingId, targetIndex);
      setMobilePreviewOrder((prev) => ({ ...prev, [date]: newOrder }));
    }
  };

  const handleMobileDragLeave = (event: React.DragEvent<HTMLDivElement>, date: string) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    if (dragLeaveTimeoutRef.current !== null) {
      window.clearTimeout(dragLeaveTimeoutRef.current);
    }
    dragLeaveTimeoutRef.current = window.setTimeout(() => {
      setMobilePreviewOrder((prev) => {
        const newState = { ...prev };
        delete newState[date];
        return newState;
      });
      dragLeaveTimeoutRef.current = null;
    }, 50);
  };

  const handleMobileDrop = (
    event: React.DragEvent<HTMLDivElement>,
    date: string,
    targetIndex: number
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const droppedId = draggingId ?? event.dataTransfer.getData("text/plain");
    const activity = findActivityById(droppedId);

    if (!activity) {
      resetDragState();
      setMobilePreviewOrder({});
      return;
    }

    const activitiesForDay = weekActivities[date] ?? [];
    const finalOrder = computeMobilePreviewOrder(activitiesForDay, droppedId, targetIndex);
    const orderedIds = finalOrder.map((a) => a.id);
    reorderInDay(date, orderedIds);

    resetDragState();
    setMobilePreviewOrder({});
  };

  // Touch drag handlers for mobile week view
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const getMobileTargetIndexFromY = useCallback((clientY: number, date: string): number => {
    const container = mobileContainerRefs.current[date];
    if (!container) return 0;
    const cards = container.querySelectorAll("[data-activity-id]");
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

  const getDateAtPosition = useCallback((clientX: number, clientY: number): string | null => {
    // Use cached rects to avoid layout thrashing
    for (const date of weekDates) {
      const rect = cachedDateRectsRef.current[date];
      if (rect) {
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          return date;
        }
      }
    }
    return null;
  }, [weekDates]);

  const handleMobileTouchStart = useCallback((
    event: React.TouchEvent<HTMLDivElement>,
    activity: Activity,
    date: string
  ) => {
    const touch = event.touches[0];
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;

    touchStartYRef.current = touch.clientY;
    touchStartXRef.current = touch.clientX;
    isTouchDraggingRef.current = false;
    touchDragDateRef.current = date;

    clearLongPressTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      isTouchDraggingRef.current = true;
      setDraggingId(activity.id);
      setIsTouchDrag(true);
      // Store offset in ref for imperative updates (no re-render)
      dragOffsetRef.current = { x: offsetX, y: offsetY };
      initialDragPosRef.current = { x: touch.clientX - offsetX, y: touch.clientY - offsetY };
      setMobilePreviewOrder({});
      // Cache date container rects at drag start to avoid layout thrashing
      cachedDateRectsRef.current = {};
      for (const d of weekDates) {
        const container = mobileContainerRefs.current[d];
        if (container) {
          cachedDateRectsRef.current[d] = container.getBoundingClientRect();
        }
      }
      // Disable scrolling and prevent pull-to-refresh on Android
      const preventDefault = (e: TouchEvent) => e.preventDefault();
      preventDefaultTouchMoveRef.current = preventDefault;
      document.addEventListener("touchmove", preventDefault, { passive: false });
      document.body.style.overscrollBehavior = "none";
      if (scrollContainer && scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = "hidden";
        scrollContainer.style.touchAction = "none";
        scrollContainer.style.overscrollBehavior = "none";
      } else {
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
      }
    }, 150);
  }, [clearLongPressTimer, scrollContainer]);

  const handleMobileTouchMove = useCallback((
    event: React.TouchEvent<HTMLDivElement>,
    _activityId: string,
    _originalDate: string
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

    // Update which date we're over (throttled to avoid excessive re-renders)
    const now = Date.now();
    if (now - lastDateUpdateRef.current > 50) {
      lastDateUpdateRef.current = now;
      const targetDate = getDateAtPosition(touch.clientX, touch.clientY);
      if (targetDate && targetDate !== touchDragDateRef.current) {
        touchDragDateRef.current = targetDate;
        setMobileDragOverDate(targetDate);
      }
    }

    // Auto-scroll when near edges
    startAutoScroll(touch.clientY);
  }, [clearLongPressTimer, getDateAtPosition, startAutoScroll]);

  const handleMobileTouchEnd = useCallback((
    activityId: string,
    originalDate: string
  ) => {
    clearLongPressTimer();

    if (isTouchDraggingRef.current) {
      const activity = findActivityById(activityId);
      const targetDate = touchDragDateRef.current || originalDate;

      if (activity) {
        const sourceDate = activity.bucket === "scheduled" ? activity.date : null;

        // If moving to a different date, schedule the activity
        if (sourceDate !== targetDate) {
          scheduleActivity(activityId, targetDate);

          // Clean up source date if it was flexible and moved
          if (sourceDate && activity.time === null) {
            const remainingSource = (weekActivities[sourceDate] ?? [])
              .filter((a) => a.id !== activityId && a.time === null)
              .map((a) => a.id);
            if (remainingSource.length > 0) {
              reorderInDay(sourceDate, remainingSource);
            }
          }
        }

        // Always compute and apply reordering for the target date
        const targetIndex = getMobileTargetIndexFromY(lastTouchPosRef.current.y, targetDate);
        const activitiesForDay = weekActivities[targetDate] ?? [];
        const finalOrder = computeMobilePreviewOrder(activitiesForDay, activityId, targetIndex);
        const orderedIds = finalOrder.map((a) => a.id);
        reorderInDay(targetDate, orderedIds);
      }
    }

    isTouchDraggingRef.current = false;
    touchDragDateRef.current = null;
    setIsTouchDrag(false);
    setMobileDragOverDate(null);
    // Reset all scroll-related styles including overscrollBehavior
    document.body.style.overscrollBehavior = "";
    if (scrollContainer && scrollContainer instanceof HTMLElement) {
      scrollContainer.style.overflow = "";
      scrollContainer.style.touchAction = "";
      scrollContainer.style.overscrollBehavior = "";
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
    setMobilePreviewOrder({});
  }, [clearLongPressTimer, findActivityById, scheduleActivity, reorderInDay, weekActivities, getMobileTargetIndexFromY, stopAutoScroll, scrollContainer]);

  const renderBucketColumn = (
    label: string,
    bucketActivities: Activity[],
    placement: Extract<Bucket, "inbox" | "later">,
    showLabel: boolean,
    totalCount: number,
    startIndex: number,
    columnIndex: number
  ) => {
    const COLUMN_HEIGHT = 5;
    const placeholderCount = Math.max(COLUMN_HEIGHT - bucketActivities.length, 0);
    let zoneIndex = startIndex;
    const isPrimaryColumn = columnIndex === 0;
    const columnHasItems = bucketActivities.length > 0;
    const isSecondaryEmpty = !isPrimaryColumn && !columnHasItems;
    const appendKey = makeBucketZoneKey(placement, totalCount);
    const ownsAppendHighlight = appendKey !== null && isPrimaryColumn;
    const interactionsEnabled = isPrimaryColumn || columnHasItems || isSecondaryEmpty;

    return (
      <div
        className="flex min-h-64 flex-col gap-2 px-1 py-3"
        onDragOver={
          interactionsEnabled
            ? (event) => handleDragOverZone(event, appendKey)
            : undefined
        }
        onDragLeave={
          interactionsEnabled ? (event) => handleDragLeaveZone(event, appendKey) : undefined
        }
        onDrop={
          interactionsEnabled
            ? (event) =>
              handleDropToBucket(event, placement, startIndex + bucketActivities.length)
            : undefined
        }
      >
        <div className="flex items-baseline justify-between gap-2 px-1">
          <div
            className={`text-sm font-semibold text-[var(--color-text-primary)] ${showLabel ? "" : "text-transparent"
              }`}
            aria-hidden={!showLabel}
          >
            {showLabel ? label : "Placeholder"}
          </div>
          {showLabel ? (
            <div className="text-xs text-[var(--color-text-meta)]">
              {totalCount > 0 ? totalCount : ""}
            </div>
          ) : (
            <div aria-hidden className="text-xs text-transparent">0</div>
          )}
        </div>
        <div>
          {bucketActivities.map((activity) => (
            (() => {
              const dropIndex = zoneIndex;
              const zoneKey = makeBucketZoneKey(placement, dropIndex);
              zoneIndex += 1;
              const isAppendHighlight =
                ownsAppendHighlight &&
                dragOverKey === appendKey &&
                dropIndex === totalCount;
              const dividerActive =
                !isSecondaryEmpty && (dragOverKey === zoneKey || isAppendHighlight);
              return (
                <div key={activity.id}>
                  <Divider
                    isActive={dividerActive}
                    onDragOver={(event) => handleDragOverZone(event, zoneKey)}
                    onDragLeave={(event) => handleDragLeaveZone(event, zoneKey)}
                    onDrop={(event) => handleDropToBucket(event, placement, dropIndex)}
                  />
                  <WeekActivityRow
                    activity={activity}
                    onToggleDone={handleToggleDone}
                    onEdit={handleEdit}
                    draggable
                    disableHover={draggingId !== null}
                    onDragStart={(event) => handleDragStart(event, activity)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(event) => handleDragOverZone(event, zoneKey)}
                    onDragLeave={(event) => handleDragLeaveZone(event, zoneKey)}
                    onDrop={(event) => handleDropToBucket(event, placement, dropIndex)}
                  />
                </div>
              );
            })()
          ))}
          {Array.from({ length: placeholderCount }).map((_, idx) => (
            <div key={`${placement}-placeholder-${idx}`}>
              {(() => {
                const dropIndex = zoneIndex;
                const zoneKey = makeBucketZoneKey(placement, dropIndex);
                zoneIndex += 1;
                const isPrimaryDrop = idx === 0;
                const isAppendHighlight =
                  ownsAppendHighlight &&
                  dragOverKey === appendKey &&
                  dropIndex === totalCount;
                const activeKey = isSecondaryEmpty ? null : isPrimaryDrop ? appendKey : zoneKey;
                const handlerKey = isSecondaryEmpty ? appendKey : activeKey;
                if (!interactionsEnabled) {
                  return (
                    <>
                      <Divider />
                      <div className="min-h-[38px]" />
                    </>
                  );
                }
                return isPrimaryDrop ? (
                  <>
                    <Divider
                      isActive={
                        activeKey !== null &&
                        !isSecondaryEmpty &&
                        (dragOverKey === activeKey || isAppendHighlight)
                      }
                      onDragOver={
                        handlerKey ? (event) => handleDragOverZone(event, handlerKey) : undefined
                      }
                      onDragLeave={
                        handlerKey ? (event) => handleDragLeaveZone(event, handlerKey) : undefined
                      }
                      onDrop={
                        handlerKey
                          ? (event) => handleDropToBucket(event, placement, dropIndex)
                          : undefined
                      }
                    />
                    <div
                      onDragOver={
                        handlerKey ? (event) => handleDragOverZone(event, handlerKey) : undefined
                      }
                      onDragLeave={
                        handlerKey ? (event) => handleDragLeaveZone(event, handlerKey) : undefined
                      }
                      onDrop={
                        handlerKey
                          ? (event) => handleDropToBucket(event, placement, dropIndex)
                          : undefined
                      }
                    >
                      <EmptySlot
                        label={`Add to ${label}`}
                        onClick={() => handleOpenCreateModal({ placement })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <Divider />
                    <div className="min-h-[38px]" />
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const formattedMonthYear = useMemo(() => {
    if (!activeDate) return "";
    const date = new Date(`${activeDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return activeDate;
    return date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [activeDate]);

  return (
    <>
      {/* Mobile stacked week */}
      <div className="lg:hidden">
        <div className="space-y-8 px-4 pt-4 pb-6">
          {weekDates.map((date) => {
            const activitiesForDay = weekActivities[date] ?? [];
            const displayActivities = mobilePreviewOrder[date] ?? activitiesForDay;
            const mobileLabel = formatMobileDayLabel(date);
            const isToday = date === activeDate;

            return (
              <section key={date} className="space-y-2">
                <div className="flex items-center justify-between text-base font-semibold">
                  <div className="flex items-center gap-1.5 text-left text-[var(--color-text-primary)]">
                    <span>{mobileLabel.weekday}</span>
                    {isToday && <FlagTriangleRight className="h-3.5 w-3.5" />}
                  </div>
                  <span className="text-right text-[var(--color-text-meta)]">{mobileLabel.monthDay}</span>
                </div>
                <Divider />
                <div
                  ref={(el) => { mobileContainerRefs.current[date] = el; }}
                  className="min-h-20 relative"
                  onDragLeave={(e) => handleMobileDragLeave(e, date)}
                  onDragOver={(e) => handleMobileDragOver(e, date, displayActivities.length)}
                  onDrop={(e) => handleMobileDrop(e, date, displayActivities.length)}
                >
                  {displayActivities.length === 0 && mobileDragOverDate !== date && (
                    <div className="absolute inset-0 flex items-start justify-center pointer-events-none">
                      <div className="w-full pt-6">
                        <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                        <div className="h-[32px]" />
                        <div className="h-px w-full rounded-full bg-[var(--color-border-divider)]" />
                      </div>
                    </div>
                  )}
                  {displayActivities.map((activity, index) => (
                    <div
                      key={activity.id}
                      data-activity-id={activity.id}
                      onDragOver={(e) => handleMobileDragOver(e, date, index)}
                      onDrop={(e) => handleMobileDrop(e, date, index)}
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
                        onTouchStart={(e) => handleMobileTouchStart(e, activity, date)}
                        onTouchMove={(e) => handleMobileTouchMove(e, activity.id, date)}
                        onTouchEnd={() => handleMobileTouchEnd(activity.id, date)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Desktop grid with Sunday + Inbox/Later row */}
      <div className="hidden lg:block">
        <h1 className="sticky top-[calc(1.5rem-24px)] z-30 mx-auto w-full bg-[var(--color-surface)] px-3 pb-3 pl-4">
          <button
            type="button"
            onClick={onResetToday}
            className="text-xl font-semibold text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
          >
            {formattedMonthYear}
          </button>
        </h1>
        <div className="mx-auto w-full px-3">
          <div className="grid grid-cols-6 gap-0">
            {topWeekDates.map((date) => {
              const activitiesForDay = weekActivities[date] ?? [];
              const { weekday, monthDay } = formatDesktopDayLabel(date);
              const isToday = date === activeDate;
              let zoneIndex = 0;
              const appendKey = makeDayAppendKey(date);

              return (
                <div
                  key={date}
                  className="flex min-h-64 flex-col gap-2 px-1 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2 px-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
                      {weekday}
                      {isToday && <FlagTriangleRight className="h-3.5 w-3.5" />}
                    </div>
                    <div className="text-sm text-[var(--color-text-meta)]">{monthDay}</div>
                  </div>
                  <div
                    onDragOver={(event) => handleDragOverZone(event, appendKey)}
                    onDragLeave={(event) => handleDragLeaveZone(event, appendKey)}
                    onDrop={(event) => handleDropOnDay(event, date, zoneIndex)}
                  >
                    {(() => {
                      const placeholderCount = Math.max(
                        desktopMaxDividerCount - activitiesForDay.length,
                        0
                      );
                      // Ensure at least 1 slot for "Add activity" even if list is full
                      const totalSlots = Math.max(placeholderCount, 1);

                      return (
                        <>
                          {activitiesForDay.map((activity) => {
                            const dropIndex = zoneIndex;
                            const zoneKey = makeDayZoneKey(date, zoneIndex);
                            zoneIndex += 1;

                            return (
                              <div key={activity.id}>
                                <Divider
                                  isActive={dragOverKey === zoneKey}
                                  onDragOver={(event) => handleDragOverZone(event, zoneKey)}
                                  onDragLeave={(event) => handleDragLeaveZone(event, zoneKey)}
                                  onDrop={(event) => handleDropOnDay(event, date, dropIndex)}
                                />
                                <WeekActivityRow
                                  activity={activity}
                                  onToggleDone={handleToggleDone}
                                  onEdit={handleEdit}
                                  draggable
                                  isDragging={draggingId === activity.id}
                                  disableHover={draggingId !== null}
                                  onDragStart={(event) => handleDragStart(event, activity)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(event) => handleDragOverZone(event, zoneKey)}
                                  onDragLeave={(event) => handleDragLeaveZone(event, zoneKey)}
                                  onDrop={(event) => handleDropOnDay(event, date, dropIndex)}
                                />
                              </div>
                            );
                          })}
                          {Array.from({ length: totalSlots }).map((_, idx) => {
                            const dropIndex = zoneIndex;
                            const zoneKey = makeDayZoneKey(date, zoneIndex);

                            zoneIndex += 1;

                            const isPrimaryDrop = idx === 0;
                            const activeKey = isPrimaryDrop ? appendKey : zoneKey;
                            return (
                              <div key={`placeholder-${idx}`}>
                                {isPrimaryDrop ? (
                                  <>
                                    <Divider
                                      isActive={dragOverKey === activeKey}
                                      onDragOver={(event) => handleDragOverZone(event, activeKey)}
                                      onDragLeave={(event) => handleDragLeaveZone(event, activeKey)}
                                      onDrop={(event) => handleDropOnDay(event, date, dropIndex)}
                                    />
                                    <div
                                      onDragOver={(event) => handleDragOverZone(event, activeKey)}
                                      onDragLeave={(event) => handleDragLeaveZone(event, activeKey)}
                                      onDrop={(event) => handleDropOnDay(event, date, dropIndex)}
                                    >
                                      <EmptySlot onClick={() => handleOpenCreateModal({ date })} />
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
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
          {extraDate && (
            <div className="mt-10 grid grid-cols-6 gap-0">
              <div>
                {renderBucketColumn(
                  "Inbox",
                  inboxPrimary,
                  "inbox",
                  true,
                  inboxActivities.length,
                  0,
                  0
                )}
              </div>
              <div>
                {renderBucketColumn(
                  "Inbox",
                  inboxSecondary,
                  "inbox",
                  false,
                  inboxActivities.length,
                  inboxPrimary.length,
                  1
                )}
              </div>
              <div>
                {renderBucketColumn(
                  "Later",
                  laterPrimary,
                  "later",
                  true,
                  laterActivities.length,
                  0,
                  0
                )}
              </div>
              <div>
                {renderBucketColumn(
                  "Later",
                  laterSecondary,
                  "later",
                  false,
                  laterActivities.length,
                  laterPrimary.length,
                  1
                )}
              </div>
              <div className="min-h-64" aria-hidden />
              <div>
                {(() => {
                  const activitiesForDay = weekActivities[extraDate!] ?? [];
                  const { weekday, monthDay } = formatDesktopDayLabel(extraDate!);
                  const isToday = extraDate === activeDate;
                  let zoneIndex = 0;
                  const appendKey = makeDayAppendKey(extraDate!);
                  return (
                    <div className="flex min-h-64 flex-col gap-2 px-1 py-3">
                      <div className="flex items-baseline justify-between gap-2 px-1">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
                          <span>{weekday}</span>
                          {isToday && <FlagTriangleRight className="h-3.5 w-3.5" />}
                        </div>
                        <div className="text-sm text-[var(--color-text-meta)]">{monthDay}</div>
                      </div>
                      <div
                        onDragOver={(event) => handleDragOverZone(event, appendKey)}
                        onDragLeave={(event) => handleDragLeaveZone(event, appendKey)}
                        onDrop={(event) => handleDropOnDay(event, extraDate!, zoneIndex)}
                      >
                        {(() => {
                          const placeholderCount = Math.max(5 - activitiesForDay.length, 0);
                          // Ensure at least 1 slot for "Add activity" even if list is full
                          const totalSlots = Math.max(placeholderCount, 1);

                          return (
                            <>
                              {activitiesForDay.map((activity) => {
                                const dropIndex = zoneIndex;
                                const zoneKey = makeDayZoneKey(extraDate!, zoneIndex);
                                zoneIndex += 1;

                                return (
                                  <div key={activity.id}>
                                    <Divider
                                      isActive={dragOverKey === zoneKey}
                                      onDragOver={(event) => handleDragOverZone(event, zoneKey)}
                                      onDragLeave={(event) => handleDragLeaveZone(event, zoneKey)}
                                      onDrop={(event) =>
                                        handleDropOnDay(event, extraDate!, dropIndex)
                                      }
                                    />
                                    <WeekActivityRow
                                      activity={activity}
                                      onToggleDone={handleToggleDone}
                                      onEdit={handleEdit}
                                      draggable
                                      isDragging={draggingId === activity.id}
                                      disableHover={draggingId !== null}
                                      onDragStart={(event) => handleDragStart(event, activity)}
                                      onDragEnd={handleDragEnd}
                                      onDragOver={(event) => handleDragOverZone(event, zoneKey)}
                                      onDragLeave={(event) => handleDragLeaveZone(event, zoneKey)}
                                      onDrop={(event) =>
                                        handleDropOnDay(event, extraDate!, dropIndex)
                                      }
                                    />
                                  </div>
                                );
                              })}
                              {Array.from({ length: totalSlots }).map((_, idx) => {
                                const dropIndex = zoneIndex;
                                const zoneKey = makeDayZoneKey(extraDate!, zoneIndex);

                                zoneIndex += 1;

                                const isPrimaryDrop = idx === 0;
                                const activeKey = isPrimaryDrop ? appendKey : zoneKey;
                                return (
                                  <div key={`sunday-placeholder-${idx}`}>
                                    {isPrimaryDrop ? (
                                      <>
                                        <Divider
                                          isActive={dragOverKey === activeKey}
                                          onDragOver={(event) => handleDragOverZone(event, activeKey)}
                                          onDragLeave={(event) => handleDragLeaveZone(event, activeKey)}
                                          onDrop={(event) =>
                                            handleDropOnDay(event, extraDate!, dropIndex)
                                          }
                                        />
                                        <div
                                          onDragOver={(event) => handleDragOverZone(event, activeKey)}
                                          onDragLeave={(event) => handleDragLeaveZone(event, activeKey)}
                                          onDrop={(event) =>
                                            handleDropOnDay(event, extraDate!, dropIndex)
                                          }
                                        >
                                          <EmptySlot
                                            onClick={() => handleOpenCreateModal({ date: extraDate! })}
                                          />
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
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
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
        initialPlacement={newActivityPlacement}
        defaultDate={newActivityDate ?? activeDate}
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
                <div className="shadow-xl rounded-xl bg-[var(--color-surface)]">
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

export default WeekPage;
